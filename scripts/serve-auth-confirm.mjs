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
 * The `/reset-password` page hands the recovery session off to the app via an
 * `exp://` deep link (auto-opened on iOS, where the Simulator's Safari can
 * reach Expo Go; shown as a button + copyable link on macOS).
 *
 * Run: npm run auth:confirm-page
 */

import { createServer } from 'http';

const PORT = 3000;
const HOST = '127.0.0.1';

const STYLE = `
  :root { color-scheme: dark; }
  body { background:#0B0F14; color:#F4F7FB; font:16px/1.6 -apple-system, system-ui, sans-serif; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:#131920; border:1px solid #1F2A36; border-radius:16px; padding:32px 40px; max-width:460px; text-align:center; }
  .icon { font-size:40px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#93A1B5; margin:0 0 16px; }
  .btn { display:inline-block; background:#22D3EE; color:#0B0F14; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:12px; margin-bottom:16px; }
  code { color:#22D3EE; font-size:12px; word-break:break-all; display:block; background:#0B0F14; border:1px solid #1F2A36; border-radius:8px; padding:10px; margin:8px 0; }
`;

// NOTE: keep this JS regex/backslash-free — template literals mangle `\`
// sequences (a `\+` became `/+/`, a SyntaxError that blanked the whole page).
const PAGE = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Subby — email verification</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="card" id="card"></div>
  <script>
    const params = new URLSearchParams(window.location.hash.slice(1));
    const card = document.getElementById('card');
    const error = params.get('error');
    const description = params.get('error_description');
    const clean = description ? description.split('+').join(' ') : null;
    if (error) {
      card.innerHTML = '<div class="icon">&#9888;&#65039;</div><h1>Link invalid or expired</h1><p>' +
        (clean || 'Try again from the app.') +
        '</p><p>Resend the link from the app, then click it once.</p>';
    } else {
      card.innerHTML = '<div class="icon">&#9989;</div><h1>Email confirmed</h1><p>Your email has been verified. You can now sign in from the app.</p>' +
        (params.get('access_token') ? '<p>You can close this tab.</p>' : '');
    }
  </script>
</body>
</html>
`;

const RESET_PAGE = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Subby — password reset</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="card" id="card"></div>
  <script>
    const params = new URLSearchParams(window.location.hash.slice(1));
    const card = document.getElementById('card');
    const error = params.get('error');
    const description = params.get('error_description');
    const clean = description ? description.split('+').join(' ') : null;
    if (error) {
      card.innerHTML = '<div class="icon">&#9888;&#65039;</div><h1>Link invalid or expired</h1><p>' +
        (clean || 'Request a new link from the app.') +
        '</p><p>In Subby: Sign in &rarr; Forgot password &rarr; send a new link, then open it in the Simulator&#39;s Safari.</p>';
    } else {
      const hostname = window.location.hostname;
      const expBase = 'exp://' + hostname + ':8081/--/reset-password';
      const subbyBase = 'subby://reset-password';
      const expLink = expBase + window.location.hash;
      const subbyLink = subbyBase + window.location.hash;
      const onSimulator = hostname.indexOf('127.0.0.1') === 0 || hostname.indexOf('localhost') === 0;
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      card.innerHTML =
        '<div class="icon">&#128273;</div><h1>Password reset</h1>' +
        '<p>Your reset link is ready. Open Subby to set a new password.</p>' +
        '<a class="btn" href="' + expLink + '">Open Subby</a>' +
        (onSimulator && !isIOS
          ? '<p>If nothing opens, this page was loaded on the Mac — Mailpit links only hand off to the app when clicked inside the Simulator&#39;s Safari. In the Simulator, open http://' + hostname + ':54324 and click the reset link there.</p>'
          : '') +
        '<code>' + expLink + '</code>' +
        '<p>Paste the original email link into the app&#39;s reset screen instead of clicking it.</p>';
      if (isIOS && !error) {
        // Simulator Safari can open Expo Go directly — skip the button.
        window.location.replace(expLink);
      }
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
  if (req.method === 'GET' && (req.url === '/reset-password' || req.url.startsWith('/reset-password#'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(RESET_PAGE);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}).listen(PORT, HOST, () => {
  console.log(`Subby auth redirect page on http://${HOST}:${PORT}`);
});
