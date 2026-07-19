# Email Database Implementation

## Overview

Create a second Firestore database (`email-db`) to separate email infrastructure data from application data.

| Database | Collections | Rules File |
|---|---|---|
| `(default)` | agencies, users, staff, payslips, invoices, timesheets, clients, contracts, logins, csv_imports, unsigned_contracts, signed_contracts, staff_uploads, unregistered_staff, staffType, tags | `firestore.rules` |
| `email-db` | passwordResets, bounceComplaints, emailSuppressions, emailLogs | `firestore-email.rules` |

## Prerequisites

- Firebase CLI v13+ (current: 15.19.0)
- `datastore.databases.create` IAM permission on each GCP project
- Service account key for `mdsce-dev` and `mdsce-prod`

## Steps

### 1. Provision `email-db` in each project

```bash
gcloud firestore databases create \
    --project=mdsce-dev \
    --database=email-db \
    --location=europe-west2 \
    --type=firestore-native

gcloud firestore databases create \
    --project=mdsce-prod \
    --database=email-db \
    --location=europe-west2 \
    --type=firestore-native
```

Also add to `send-staff-email/scripts/createInfra.sh` after the existing `gcloud firestore databases create` block (around line 46) so new project bootstraps automatically create it.

### 2. Create `firestore-email.rules`

**File:** `mdsce-main/firestore-email.rules`
**Deploy target:** `--only firestore:email-db`

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Password reset tokens — Admin SDK only
    match /passwordResets/{token} {
      allow read, write: if false;
    }

    // SES bounce/complaint records — Admin SDK only
    match /bounceComplaints/{docId} {
      allow read, write: if false;
    }

    // Email suppression list — Admin SDK only
    match /emailSuppressions/{email} {
      allow read, write: if false;
    }

    // General email audit log — Admin SDK only
    match /emailLogs/{docId} {
      allow read, write: if false;
    }
  }
}
```

### 3. Create `firestore-email.indexes.json`

**File:** `mdsce-main/firestore-email.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "passwordResets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 4. Update `firebase.json`

Replace the single `firestore` object with an array. Current format (before):

```json
{
  "firestore": {
    "database": "(default)",
    "location": "europe-west2",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  ...
}
```

New format (after) — note `location` is removed (set at DB creation time, not in config):

```json
{
  "firestore": [
    {
      "database": "(default)",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    },
    {
      "database": "email-db",
      "rules": "firestore-email.rules",
      "indexes": "firestore-email.indexes.json"
    }
  ],
  ...
}
```

### 5. Purge `passwordResets` from existing files

- **`firestore.rules`** — remove lines 205-208:
  ```
  // Password reset tokens — Admin SDK only, no client access
  match /passwordResets/{token} {
    allow read, write: if false;
  }
  ```
- **`firestore.indexes.json`** — remove the `passwordResets` composite index entry (collectionGroup: "passwordResets", fields: uid ASC, expiresAt ASC). It moves to `firestore-email.indexes.json`.

### 6. Update client SDK

**File:** `mdsce-main/src/services/firebase.ts`

```typescript
import { getFirestore } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);                              // (default) — app data
export const emailDb = getFirestore(app, "email-db");            // email silo
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west2");
```

### 7. Update Admin SDK

**File:** `mdsce-main/functions/src/services/EmailService.ts:66`

Change:
```typescript
getFirestore()
```
to:
```typescript
getFirestore("email-db")
```

This routes the `ResetPasswordTokenManager` instantiation in `EmailService` to the email database.

Any future email-compliance cloud functions (SES SNS webhooks for bounces/complaints, suppression list management) should also use `getFirestore("email-db")`.

Functions that read/write application data (staff, payslips, agencies, etc.) continue using `getFirestore()` (default) and need no changes.

### 8. CI/CD

**`send-staff-email/scripts/deployRules.sh`**
No changes needed — `firebase deploy --only firestore` automatically deploys rules + indexes for all databases configured in the `firebase.json` array.

**`.github/workflows/ci.yml`**
No changes needed — the existing `npm run deploy:dev` / `npm run deploy:prod` scripts call `firebase deploy` which reads `firebase.json` and handles all databases.

**Deploy workaround** (if `--only firestore` has issues with the array format):
```bash
# Deploy all databases (rules + indexes)
firebase deploy --only firestore

# Deploy single database
firebase deploy --only firestore:(default)
firebase deploy --only firestore:email-db
```

**Note on known bug:** `--only firestore:rules` silently no-ops with the array format (firebase-tools #10468). Always use `--only firestore` or `--only firestore:<db-name>` instead.

### 9. Data migration

If `passwordResets` already has documents in the `(default)` database, run this one-shot migration script:

```bash
firebase use development  # or production
```

Then execute:

```typescript
import { getFirestore } from "firebase-admin/firestore";

async function migratePasswordResets() {
  const src = getFirestore();
  const dst = getFirestore("email-db");
  const snap = await src.collection("passwordResets").get();

  if (snap.empty) {
    console.log("No passwordResets to migrate.");
    return;
  }

  let count = 0;
  const batch = dst.batch();
  snap.docs.forEach((doc) => {
    batch.set(dst.collection("passwordResets").doc(doc.id), doc.data());
    count++;
  });
  await batch.commit();
  console.log(`Migrated ${count} passwordReset documents to email-db.`);
}

migratePasswordResets().catch(console.error);
```

## Verification

```bash
# List all databases in a project
gcloud firestore databases list --project=mdsce-dev

# Deploy firestore config
firebase deploy --project development --only firestore

# Verify rules via Firebase Console
# open https://console.firebase.google.com/project/mdsce-dev/firestore/rules
# Use the database dropdown to switch between (default) and email-db
```

## Replicate to other subprojects

If `8-email-compliance-prd` and `send-staff-email` also need this, repeat steps 2-7 for each (they have identical file structures).

## Unchanged

- `.firebaserc` — project aliases are database-agnostic
- `storage.rules` and `cors.json` — no changes needed
- Existing cloud functions reading/writing app data — they use `getFirestore()` (default), unaffected
- Environment files (`.env.*`, `functions/.env.*`) — no changes needed
