/**
 * Serve the local auth redirect target (the `site_url` in supabase/config.toml).
 *
 * Supabase auth emails (email confirmation, password reset) redirect the
 * browser to `site_url` after the token is consumed. By default that is
 * http://127.0.0.1:3000, which nothing listens on — so a successful
 * confirmation lands on a "connection refused" page and looks broken.
 *
 * This server renders a minimal success/error page by parsing the URL
 * fragment GoTrue appends:
 *   success: #access_token=... (implicit flow)
 *   failure: #error=...&error_description=...
 *
 * Run: npm run auth:confirm-page
 */

import { createServer } from 'http';

const PORT = 3000;
const HOST = '127.0.0.1';

const PAGE = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Subby — email verification</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0B0F14; color:#F4F7FB; font:16px/1.6 -apple-system, system-ui, sans-serif; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:#131920; border:1px solid #1F2A36; border-radius:16px; padding:32px 40px; max-width:420px; text-align:center; }
  .icon { font-size:40px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#93A1B5; margin:0 0 16px; }
  code { color:#22D3EE; font-size:13px; word-break:break-all; }
  a { color:#22D3EE; }
</style>
</head>
<body>
  <div class="card" id="card"></div>
  <script>
    const params = new URLSearchParams(window.location.hash.slice(1));
    const card = document.getElementById('card');
    const error = params.get('error');
    const description = params.get('error_description');
    if (error) {
      card.innerHTML = '<div class="icon">⚠️</div><h1>Link invalid or expired</h1><p>' +
        (description ? description.replace(/\+/g, ' ') : 'Try again from the app.') +
        '</p><p>Resend the link from the app, then click it once.</p>';
    } else {
      card.innerHTML = '<div class="icon">✅</div><h1>Email confirmed</h1><p>Your email has been verified. You can now sign in from the app.</p>' +
        (params.get('access_token') ? '<p>You can close this tab.</p>' : '');
    }
  </script>
</body>
</html>
`;

createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/#'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}).listen(PORT, HOST, () => {
  console.log(`Subby auth redirect page on http://${HOST}:${PORT}`);
});
