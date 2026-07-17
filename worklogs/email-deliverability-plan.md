# Email Deliverability Plan

## Overview

Analysis of the current email system against the inbox-friendly criteria. Items are split into **code changes** (implement in the repo) and **infrastructure setup** (configure externally — DNS, SMTP provider, etc.).

---

## Code Changes

### 1. `UNSUBSCRIBE_BASE_URL` — missing from env files

The param is defined in `EmailService.ts:29` but **not present** in either `.env.mdsce-dev` or `.env.mdsce-prod`. This will cause a runtime crash if `sendEmail()` is called.

**Action:** Add to both env files:
```
UNSUBSCRIBE_BASE_URL=https://europe-west2-<project>.cloudfunctions.net
```

File: `functions/.env.mdsce-dev`, `functions/.env.mdsce-prod`

---

### 2. `List-Unsubscribe` / `List-Unsubscribe-Post` SMTP headers

Currently only a visible HTML unsubscribe link exists (`{{unsubscribeUrl}}` in templates). Gmail/Yahoo require `List-Unsubscribe` headers for bulk senders.

**Action:** Add headers to every `sendMail()` call in `EmailService.ts:114-135`:

```typescript
await this.registrationTransporter.sendMail({
  from: ...,
  to: ...,
  subject: ...,
  html: body,
  headers: {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});
```

File: `functions/src/services/EmailService.ts`

---

### 3. Bounce tracking — categorize SMTP errors and persist to suppression

SMTP errors are caught at line 137 but thrown away (logged only). We need to:
- Parse the SMTP response to distinguish **temporary (4xx)** vs **permanent (5xx)** failures
- For permanent (5xx) bounces: write to Firestore `emailSuppressions/{email}/senders/{sender}` with `reason: "bounce"`
- For temporary (4xx): log + count but do **not** suppress (the batch retry mechanism will retry)
- Track consecutive temporary failures per recipient and suppress after N (e.g. 3) consecutive failures

**Action:**
1. Create `functions/src/emailSuppressions/bounceHandler.ts` with a function to parse SMTP errors and decide action
2. Modify `sendEmail()` in `EmailService.ts` to call the bounce handler on error
3. The bounce handler writes to suppression via `EmailSuppressionManager.add()` with `reason: "bounce"`

Files: `functions/src/emailSuppressions/bounceHandler.ts` (new), `functions/src/services/EmailService.ts`

---

### 4. Scheduled cleanup of inactive subscribers

Gmail/Yahoo require periodic removal of recipients who haven't engaged (opened/clicked) in X months.

**Action:** Create a scheduled Cloud Function (`functions/src/emailSuppressions/cleanupInactive.ts`) that:
- Queries Firestore for recipients with no engagement in 6+ months
- Writes suppression docs for those recipients with `reason: "unsubscribed"`
- Runs on a cron schedule (weekly via `onSchedule`)

This requires we first track engagement (opens/clicks). If we don't currently track opens — we need to add tracking pixels or use the SMTP provider's engagement data. For now, we can use a simpler approach: after N failed sends over time, suppress.

**Recommended approach (short-term):** Start by tracking consecutive bounce failures and suppress after threshold. Engagement-based cleanup is a future enhancement once open/click tracking is in place.

File: `functions/src/emailSuppressions/cleanupInactive.ts` (new)

---

### 5. No resubscribe endpoint — already correct

Confirmed: There is no callable/endpoint to remove from suppression in production. The only removal is in `EmailSuppressionManager.remove()` which is purely a utility method — it's not exposed as a Cloud Function. This satisfies the "don't reactivate" criterion automatically.

No action needed.

---

### 6. RFC 5321 / 5322 compliance — Message-ID, Date headers

Nodemailer automatically generates `Message-ID` and `Date` headers for every message. These are added by the nodemailer library itself and don't require code changes.

Verified by: nodemailer source adds `messageId()` and `date` in `_generateHeaders()`.

No action needed.

---

### 7. Use consistent From: name and address

Already in place — the three stream-specific From addresses are:
- `MDS Payroll <registration@mds-ce.com>`
- `MDS Payroll <payslips@mds-ce.com>`
- `MDS Payroll <documents@mds-ce.com>`

No action needed.

---

### 8. Segment marketing and transactional streams

Already in place — three separate SMTP transporters (`registrationTransporter`, `payslipsTransporter`, `documentsTransporter`). Got feedback loops from the user — the user wants to keep this as-is.

No action needed.

---

## Infrastructure Setup

### 9. Publish SPF DNS record

SPF declares which IPs are authorized to send mail for your domain.

**DNS TXT record for `mds-ce.com`:**
```
v=spf1 mx ip4:<SENDING-IP> include:<SMTP-PROVIDER-INCLUDE> ~all
```

**Steps:**
1. Log into your DNS provider (where `mds-ce.com` is managed)
2. Add a TXT record:
   - Name: `@` (or `mds-ce.com`)
   - Value: `v=spf1 mx ip4:<your-mail-server-ip> ~all`
   - TTL: 3600
3. Wait for propagation (5–30 mins)
4. Verify with: `dig txt mds-ce.com`

If using a third-party SMTP provider, include their SPF include (e.g. `include:spf.mandrillapp.com`).

---

### 10. Publish DKIM DNS record

DKIM signs emails with a private key; receiving servers verify with a public key published in DNS.

**Steps:**
1. Generate a DKIM key pair for `mds-ce.com` (on your mail server)
2. Publish the public key as a DNS TXT record:
   - Name: `mdsce._domainkey.mds-ce.com`
   - Value: `v=DKIM1; k=rsa; p=<BASE64-PUBLIC-KEY>`
3. Configure your SMTP server (mail.mds-ce.com) to sign outgoing emails with the private key
4. Verify with: `dig txt mdsce._domainkey.mds-ce.com`

---

### 11. Publish DMARC DNS record

DMARC tells receiving servers what to do if SPF or DKIM fails.

**DNS TXT record for `_dmarc.mds-ce.com`:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@mds-ce.com; pct=100
```

**Policy options:**
- `p=none` — monitor only (start here)
- `p=quarantine` — mark as spam (once SPF/DKIM are verified working)
- `p=reject` — hard reject (final stage)

**Steps:**
1. Add a TXT record:
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc-reports@mds-ce.com`
   - TTL: 3600
2. Monitor reports from `rua` address for a few weeks
3. Gradually tighten policy from `none` → `quarantine` → `reject`

---

### 12. Publish reverse DNS (rDNS / PTR record)

Reverse DNS maps your sending IP back to your domain. Most receiving servers (Gmail, Outlook) reject or penalize mail from IPs without rDNS.

**Steps:**
1. Contact your hosting provider or ISP that owns your SMTP server's IP address
2. Request a PTR record pointing `<YOUR-SERVER-IP>` → `mail.mds-ce.com`
3. Verify with: `dig -x <YOUR-SERVER-IP>` or `nslookup <YOUR-SERVER-IP>`

---

### 13. Consistent sending IP addresses

Ensure your SMTP server (`mail.mds-ce.com`) uses a static IP or a dedicated IP pool, not a shared pool that changes. This helps build sender reputation.

**Steps:**
1. Check with your hosting provider whether `mail.mds-ce.com` has a dedicated IP
2. If not, request a dedicated IP
3. Verify the IP doesn't change on restarts

---

### 14. ARC headers (Authenticated Received Chain)

ARC is used when email is **forwarded** (e.g. Gmail forwarding to another address). Since we originate emails (not forward), ARC is typically handled by intermediate MTAs, not the originator.

**No action needed** for our sending. ARC headers would only matter if we operated a mail forwarding service. However, if your SMTP provider (mail.mds-ce.com) forwards mail, they should enable ARC on their end.

---

### 15. Track temporary (4xx) and permanent (5xx) SMTP errors

**Code change** (covered in items 3 above) — after parsing SMTP errors, the system should:
- Log all errors
- Write permanent failures to suppression (reason: `"bounce"`)
- Track consecutive temporary failures per recipient and suppress after N attempts
- Expose failure metrics via logs or a Firestore counter

For the **infrastructure side**: configure your SMTP server to log all delivery status notifications (DSNs) and make them accessible for analysis.

---

### 16. Standard bounce handling policy

Documented policy (to be created at `docs/bounce-policy.md`):
- **Permanent (5xx)**: Immediate suppression after 1 failure
- **Temporary (4xx)**: Retry up to 3 times over 7 days, then suppress
- **Unknown**: Treat as temporary, retry
- **Suppression retention**: Indefinite (never resend to suppressed addresses)
- **Bounce reason storage**: Stored in Firestore `emailSuppressions/{email}/senders/{sender}` with `reason: "bounce"`

---

### 17. Periodically remove inactive subscribers

Deferred to future enhancement (requires open/click tracking). See item 4 above for the scheduled function skeleton.

---

### 18. Don't reactivate suppressed addresses

Already satisfied — no endpoint exists to remove suppressions. The `EmailSuppressionManager.remove()` method exists as a utility but is not exposed as a Cloud Function or API endpoint.

---

## Testing

### Tests to write/update

| Test | File | Description |
|---|---|---|
| `List-Unsubscribe` header present | `emailService.test.ts` | Assert every `sendMail` call includes `headers["List-Unsubscribe"]` |
| `List-Unsubscribe-Post` header present | `emailService.test.ts` | Assert every `sendMail` call includes `headers["List-Unsubscribe-Post"]` |
| Bounce: 5xx suppresses | `emailService.test.ts` | Mock SMTP with 5xx error, verify suppression doc written |
| Bounce: 4xx does NOT suppress | `emailService.test.ts` | Mock SMTP with 4xx error, verify no suppression doc written |
| Bounce: threshold triggers suppression | `emailService.test.ts` | N consecutive 4xx errors trigger suppression |
| Suppression skip on unsubscribed | `emailService.test.ts` | Already tested implicitly via suppression manager mock |
| Unsubscribe URL env present | `emailService.test.ts` | Verify unsubscribe URL is injected into HTML body |
| Scheduled cleanup function | `cleanupInactive.test.ts` | Verify inactive subscribers are suppressed (future) |

---

## Summary of Effort

| Item | Type | Effort |
|---|---|---|
| 1. `UNSUBSCRIBE_BASE_URL` env | Code | 5 min |
| 2. `List-Unsubscribe` headers | Code | 30 min |
| 3. Bounce tracking | Code | 2 hr |
| 4. Inactive cleanup function | Code | 1 hr (future) |
| 5. SPF DNS record | Infrastructure | 15 min |
| 6. DKIM DNS record | Infrastructure | 30 min |
| 7. DMARC DNS record | Infrastructure | 15 min |
| 8. rDNS / PTR record | Infrastructure | 30 min (depends on ISP) |
| 9. Dedicated sending IP | Infrastructure | Varies (ISP dependant) |
| 10. Tests for the above | Code | 1 hr |
