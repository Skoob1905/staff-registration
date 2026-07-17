/**
 * Builds a minimal HTML page shown after a successful unsubscribe.
 */
export function successHtml(email: string, sender: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Unsubscribed</title>
    <style>
      body { font-family: Arial, sans-serif; background: #e5e5e5; margin: 0; padding: 20px; }
      .card { max-width: 480px; margin: 60px auto; background: #faf9f9; padding: 30px; border-radius: 12px; border: 1px solid rgba(210,38,48,0.25); text-align: center; }
      h1 { color: #1a365d; font-size: 22px; margin: 0 0 12px; }
      p { color: #666; font-size: 14px; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Unsubscribed</h1>
      <p><strong>${escapeHtml(email)}</strong> has been unsubscribed from <strong>${escapeHtml(sender)}</strong> emails.</p>
    </div>
  </body>
</html>`;
}

/**
 * Builds a minimal HTML page shown when the unsubscribe link is invalid.
 */
export function errorHtml(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Unsubscribe Error</title>
    <style>
      body { font-family: Arial, sans-serif; background: #e5e5e5; margin: 0; padding: 20px; }
      .card { max-width: 480px; margin: 60px auto; background: #faf9f9; padding: 30px; border-radius: 12px; border: 1px solid rgba(210,38,48,0.25); text-align: center; }
      h1 { color: #1a365d; font-size: 22px; margin: 0 0 12px; }
      p { color: #666; font-size: 14px; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Something went wrong</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
