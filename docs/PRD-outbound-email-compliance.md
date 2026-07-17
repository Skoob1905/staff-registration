# PRD: Outbound Email Compliance & Template Refresh

**Ticket:** #8
**Status:** Draft
**Date:** 2026-07-16

## Objective

Bring all outbound email flows into compliance with email delivery best practices (SPF, DKIM, DMARC, rDNS, List-Unsubscribe, bounce handling, suppression management) and refactor templates to use consistent branding per stream.

## Compliance Criteria (from ticket)

- [ ] Send only to explicitly subscribed recipients
- [ ] Offer an unsubscribe link in every email
- [ ] Add ARC headers to forwarded emails
- [ ] Comply with RFC 5321 and RFC 5322
- [ ] Publish reverse DNS (rDNS) for sending IPs
- [ ] Use consistent sending IPs/domains per stream (segmented: marketing vs transactional)
- [ ] Use a consistent From: name/address per stream
- [ ] SPF, DKIM, DMARC authentication
- [ ] Track temp/permanent SMTP errors and act on them
- [ ] Standard policy for bouncing addresses
- [ ] Periodically remove inactive subscribers
- [ ] Don't reactivate suppressed/unsubscribed addresses

---

## 1. External / DNS Setup (SES Provider)

These are one-time configuration steps in AWS SES (or the chosen SMTP provider) and DNS.

| # | Requirement | Action | Owner |
|---|---|---|---|
| 1.1 | **Reverse DNS (rDNS)** | Configure PTR records for each sending Elastic IP via AWS SES — raised via AWS support ticket. | Infrastructure |
| 1.2 | **SPF record** | Publish `v=spf1 include:amazonses.com ~all` (or equivalent) in DNS for the sending domain. | Infrastructure |
| 1.3 | **DKIM signing** | Generate DKIM keys in SES, publish the CNAME records in DNS. | Infrastructure |
| 1.4 | **DMARC policy** | Publish `_dmarc.<domain>. TXT v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>` in DNS. Start with `p=none`, move to `p=quarantine` then `p=reject`. | Infrastructure |
| 1.5 | **Dedicated sending IPs** | Request dedicated IPs from SES. Route **transactional** (payslips, documents, password resets) through one IP pool, **marketing** (registration links) through a separate pool. | Infrastructure |
| 1.6 | **SES Configuration Sets** | Create configuration sets per stream to enable open/click/bounce tracking via SNS → Firestore. | Infrastructure |

---

## 2. App Code Changes

### 2.1 Unsubscribe Mechanism

**Every email must include a `List-Unsubscribe` header and a visible unsubscribe link.**

| # | Change | File(s) |
|---|---|---|
| 2.1.1 | Add new callable cloud function `unsubscribeEmail`: accepts `email` param, adds doc to `emailSuppressions/{email}`. | `functions/src/index.ts` |
| 2.1.2 | Add new callable cloud function `resubscribeEmail`: accepts `email` param, deletes `emailSuppressions/{email}`. Admin-only. | `functions/src/index.ts` |
| 2.1.3 | Add `getUnsubscribeUrl(email: string)` helper that returns the one-click unsubscribe URL pointing to a lightweight HTML page + the callable function. | `functions/src/services/unsubscribe.ts` (new) |
| 2.1.4 | Add `List-Unsubscribe: <${unsubscribeUrl}>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers to every `sendMail` call. | `EmailService.ts` |
| 2.1.5 | Append `{{unsubscribeUrl}}` placeholder to every HTML template, rendered as a visible link. | All `.html` templates in `templates/` |
| 2.1.6 | Add `mailto:unsubscribe@<domain>` fallback to `List-Unsubscribe` header (RFC 2369). | `EmailService.ts` |
| 2.1.7 | Build a minimal hosted unsubscribe page (e.g. `/unsubscribe?email=...&token=...`). | `src/pages/Unsubscribe.tsx` (new) |

### 2.2 Suppression / Bounce Handling

| # | Change | File(s) |
|---|---|---|
| 2.2.1 | Create Firestore collection `emailSuppressions` with documents keyed by lowercased email: `{ email, reason: "unsubscribed"|"bounce"|"complaint", createdAt }`. | Firestore schema |
| 2.2.2 | Create Firestore collection `emailBounces` with docs: `{ email, type: "permanent"|"transient", count, lastBouncedAt, diagnosticCode }`. | Firestore schema |
| 2.2.3 | In `EmailProvider.sendEmail`, check `emailSuppressions/{email}` before sending; skip silently if suppressed. Log a warning. | `EmailService.ts` |
| 2.2.4 | After `sendMail` throws, parse the SMTP error code: 5xx → permanent bounce, 4xx → transient. Upsert `emailBounces` doc. On 3rd permanent bounce → auto-add to `emailSuppressions`. | `EmailService.ts` |
| 2.2.5 | No reactivation path for suppressed addresses — only `resubscribeEmail` callable (admin-only). | `unsubscribe.ts` |

### 2.3 ARC Headers (Email Forwarding)

| # | Change | File(s) |
|---|---|---|
| 2.3.1 | When forwarding an email (if we do any forwarding), add `ARC-Seal`, `ARC-Message-Signature`, `ARC-Authentication-Results` headers before re-sending. For SES-based sending this is typically handled at the SES level — verify. | Investigation needed — may be SES config only. |

### 2.4 RFC 5321 / 5322 Compliance

| # | Change | File(s) |
|---|---|---|
| 2.4.1 | Audit all nodemailer `sendMail` calls to ensure these required headers are present: `Date`, `Message-ID`, `From`, `To`, `Subject`, `MIME-Version`, `Content-Type`. | `EmailService.ts` |
| 2.4.2 | Ensure `From` uses the correct per-stream format: `MDS Payroll <${stream-specific-from-address}>`. Already partially done. | `EmailService.ts` |
| 2.4.3 | Validate that HTML bodies include `<!DOCTYPE html>` and `<html>` wrapper for MIME compliance. | All templates |

### 2.5 Consistent From: Per Stream

| Stream | From address | Transporter |
|---|---|---|
| Registration (worker/agency/client invites, password resets) | `REGISTRATION_SMTP_FROM` | `registrationTransporter` |
| Payslips | `PAYSLIPS_SMTP_FROM` | `payslipsTransporter` |
| Documents | `DOCUMENTS_SMTP_FROM` | `documentsTransporter` |

Already implemented — verify in each `sendMail` call.

---

## 3. DB + Cloud Functions

### Firestore Collections

```
emailSuppressions/{email}
  - email: string
  - reason: "unsubscribed" | "bounce" | "complaint"
  - createdAt: Timestamp

emailBounces/{autoId}
  - email: string
  - type: "permanent" | "transient"
  - count: number
  - lastBouncedAt: Timestamp
  - diagnosticCode?: string
```

### Cloud Functions

| # | Function | Trigger | Description |
|---|---|---|---|
| 3.1 | `unsubscribeEmail` | Callable (no auth) | Adds `emailSuppressions/{email}` doc. Used by the unsubscribe link/button. |
| 3.2 | `resubscribeEmail` | Callable (admin-only) | Removes `emailSuppressions/{email}` doc. Only super admins can reactivate. |
| 3.3 | `scheduledCleanupInactive` | Scheduled (monthly via `onSchedule`) | Queries `emailBounces` for addresses with no successful send in 6 months; notifies or suppresses. |

---

## 4. Testing

All tests in `functions/src/services/__tests__/emailService.test.ts`.

| # | Test | Description |
|---|---|---|
| 4.1 | Every email method includes `List-Unsubscribe` header | Use nodemailer mock to verify header presence on each `sendMail` call. |
| 4.2 | Every email method includes `List-Unsubscribe-Post` header | Same as above. |
| 4.3 | Suppressed addresses are silently skipped | Mock `emailSuppressions` doc as present; verify `sendMail` not called. |
| 4.4 | Bounce tracking: permanent | Mock `sendMail` rejection with 5xx error; verify `emailBounces` doc created, auto-suppressed after threshold. |
| 4.5 | Bounce tracking: transient | Mock `sendMail` rejection with 4xx error; verify count incremented but not auto-suppressed. |
| 4.6 | Unsubscribe callable adds suppression doc | Call `unsubscribeEmail` with email; verify doc written to Firestore mock. |
| 4.7 | Resubscribe callable removes suppression doc | Call `resubscribeEmail` with email (as admin); verify doc deleted. |
| 4.8 | From: matches per-stream transporter | Assert `sendMail` called with correct `from` per stream (already covered by existing tests). |
| 4.9 | RFC 5322 headers present | Mock `sendMail` and assert `Date`, `Message-ID`, `Content-Type` are set. |

---

## 5. Implementation Order

1. **Infrastructure (1.1–1.6)** — DNS changes, SES config sets, dedicated IP pools. Non-blocking for dev.
2. **Unsubscribe mechanism (2.1)** — callable functions, header injection, template changes.
3. **Suppression + bounce handling (2.2, 3)** — Firestore schema, pre-send check, error parsing.
4. **RFC compliance audit (2.4)** — header order, MIME structure, template audit.
5. **Tests (4)** — all test cases.
6. **ARC headers (2.3)** — investigate SES forwarding capabilities last, lowest impact.

---

## Appendix: Template Inventory

| Template File | Used By | Stream | Has Unsubscribe? |
|---|---|---|---|
| `registration.html` | Worker invites | Registration | ❌ |
| `agencyRegistration.html` | Agency invites | Registration | ❌ |
| `clientRegistration.html` | Client invites | Registration | ❌ |
| `forgotPassword.html` | Password reset | Registration | ❌ |
| `sendDocument.html` | Document uploaded | Documents | ❌ |
| `sendPayslip.html` | Payslip received | Payslips | ❌ |

All templates need the `{{unsubscribeUrl}}` placeholder appended.
