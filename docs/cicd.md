# CI/CD

## GitHub Actions workflow (`.github/workflows/ci.yml`)

### Triggers

| Event | Branch | Action |
|---|---|---|
| `pull_request` | any | CI only (lint, test, build) |
| `push` | `dev` | CI + deploy to **dev** project |
| `push` | `main` | CI + deploy to **prod** project |

These pushes deploy to Firebase Hosting/Firestore/Functions, not Vercel.

### Jobs

**`ci`** — runs on every PR and every push to `dev` or `main`:
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

**`deploy`** — runs after `ci` only on push to `dev` or `main`:
- Authenticates to GCP via Workload Identity (service account JSON key stored in GitHub secrets)
- Builds client with the appropriate Vite mode (`development` for dev, `production` for prod)
- Runs `firebase deploy` with the corresponding project alias (`dev` or `prod`)

### Deploy targets

| Target | Firebase project | Hosting URL | Branch trigger |
|---|---|---|---|
| Production | `handysign-ab77f` | `https://handysign-ab77f.web.app` | `main` |
| Development | `handysign-dev` | `https://handysign-dev.web.app` | `dev` |

### GitHub secrets required

| Secret name | Description |
|---|---|
| `GCP_SA_KEY_PROD` | JSON key for the service account with Firebase Admin role on the prod project |
| `GCP_SA_KEY_DEV` | JSON key for the service account with Firebase Admin role on the dev project |

## Vercel deployment control

Automatic Vercel Git deployments are disabled in `vercel.json`, so pushes no longer consume Vercel deployment credits by default.

Use the manual workflow in `.github/workflows/vercel-manual.yml` whenever you want a Vercel deploy:

1. Open the **Actions** tab in GitHub
2. Select **Vercel Manual Deploy**
3. Choose `preview` or `production`
4. Run the workflow from the branch you want to deploy

### Vercel secrets required

| Secret name | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal/team token used by the CLI |
| `VERCEL_ORG_ID` | Vercel team or personal account ID |
| `VERCEL_PROJECT_ID` | Vercel project ID for this app |

### Env files

Vite automatically loads the correct `.env` file based on the mode:

- `vite build` (production mode) → loads `.env.production`
- `vite build --mode development` → loads `.env.development`

Cloud Functions loads the correct `.env` file based on the project alias:

- `firebase deploy --project dev` → also loads `functions/.env.dev`
- `firebase deploy --project prod` → also loads `functions/.env.prod`
