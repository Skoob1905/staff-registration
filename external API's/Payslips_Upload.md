# Payslip Upload API — Base64 method

This guide explains how to upload a payslip using the base64 method.

---

## What you need

| Item | Where to get it |
|---|---|
| **API Key** | Provided to you by us (see below) |
| **PDF file** | The payslip you want to upload |
| **Staff email** | The email address of the staff member this payslip belongs to |

---

## Your API Key

```
╔══════════════════════════════════════════╗
║                                          ║
║          YOUR API KEY                    ║
║                                          ║
║   API KEY: _______________________       ║
║                                          ║
║   (we will fill this in for you)         ║
║                                          ║
╚══════════════════════════════════════════╝
```

Keep this key safe. It expires **3 months** after issue.

---

## Step 1: Convert your PDF to base64

Open **Terminal** (Mac) or **Command Prompt** (Windows) and run:

```bash
base64 -i /path/to/your/payslip.pdf
```

Replace `/path/to/your/payslip.pdf` with the actual location of your PDF file.

The command will print a very long string of letters and numbers. **Copy the entire string**.

> **Tip:** On Mac you can add ` | pbcopy` to copy it automatically:
> ```bash
> base64 -i /path/to/your/payslip.pdf | pbcopy
> ```

---

## Step 2: Send the command

```bash
curl -X POST "https://europe-west2-mdsce-dev.cloudfunctions.net/uploadPayslipExternal" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_GOES_HERE" \
  -d '{
    "fileBase64": "YOUR_BASE64_TEXT_GOES_HERE",
    "fileName": "payslip-january.pdf",
    "clientEmail": "john@company.com"
  }'
```

Replace these placeholders:

| Placeholder | Replace with |
|---|---|
| `YOUR_API_KEY_GOES_HERE` | The API key we gave you |
| `YOUR_BASE64_TEXT_GOES_HERE` | The long base64 text from Step 1 |
| `payslip-january.pdf` | The actual filename of your PDF |
| `john@company.com` | The actual staff member's email address |

---

## Step 3: Check the result

If the upload worked, you will see:

```json
{
  "ok": true,
  "payslipId": "abc123...",
  "url": "https://..."
}
```

The `url` is the link to the uploaded payslip.

---

## Troubleshooting

| Error | Status | What it means | What to do |
|---|---|---|---|
| `Missing X-API-Key header` | 401 | You forgot to include your API key | Add `-H "X-API-Key: YOUR_KEY"` |
| `Invalid API Key` | 401 | The API key is wrong | Check you copied it correctly |
| `Please request a new API Key to be created and sent` | 403 | Your API key has expired | Contact us for a new key |
| `fileBase64, fileName, and clientEmail are required` | 400 | Missing one of the three fields | Check your command includes all three |
| `Staff member not found with that email` | 404 | No staff member has that email | Check the email is correct |

---

## Need help?

Contact the MDSCE team.
