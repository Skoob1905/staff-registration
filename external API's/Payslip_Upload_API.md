# Payslip Upload API — How to upload a payslip

This guide explains two ways to upload a staff member's payslip PDF using the API.

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

## Method 1: Upload the PDF file directly (recommended)

```bash
curl -X POST "https://europe-west2-mdsce-dev.cloudfunctions.net/uploadPayslipExternal?clientEmail=john@company.com&fileName=payslip-january.pdf" \
  -H "X-API-Key: YOUR_API_KEY_GOES_HERE" \
  --data-binary @/path/to/your/payslip.pdf
```

| Part | What it does |
|---|---|
| `"?clientEmail=..."` | The staff member's email |
| `"&fileName=..."` | The filename for the payslip |
| `-H "X-API-Key: ..."` | Your secret API key |
| `--data-binary @...` | Sends your PDF file directly |

---

## Method 2: Upload using base64

### Step 1: Convert your PDF to base64

```bash
base64 -i /path/to/your/payslip.pdf
```

Copy the output. On Mac you can use:

```bash
base64 -i /path/to/your/payslip.pdf | pbcopy
```

### Step 2: Send the command

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

| Placeholder | Replace with |
|---|---|
| `YOUR_API_KEY_GOES_HERE` | The API key we gave you |
| `YOUR_BASE64_TEXT_GOES_HERE` | The base64 text from Step 1 |
| `payslip-january.pdf` | The actual filename |
| `john@company.com` | The staff member's email |

---

## Check the result

```json
{
  "ok": true,
  "payslipId": "abc123...",
  "url": "https://..."
}
```

---

## Troubleshooting

| Error | Status | What to do |
|---|---|---|
| `Missing X-API-Key header` | 401 | Add `-H "X-API-Key: YOUR_KEY"` |
| `Invalid API Key` | 401 | Check your API key is correct |
| `Please request a new API Key to be created and sent` | 403 | Contact us for a new key |
| `Staff member not found with that email` | 404 | Check the email is correct |

---

## Need help?

Contact the MDSCE team.
