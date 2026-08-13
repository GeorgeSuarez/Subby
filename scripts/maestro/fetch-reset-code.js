// Fetch the newest reset-code email for test@subby.app from local Mailpit.
const list = http.get('http://127.0.0.1:54324/api/v1/messages').body;
const mail = JSON.parse(list);
const msg = mail.messages.find((m) => m.To[0].Address === 'test@subby.app');
if (!msg) {
  throw new Error('no reset email found in Mailpit');
}
const full = JSON.parse(
  http.get('http://127.0.0.1:54324/api/v1/message/' + msg.ID).body,
);
const match = /\b(\d{6})\b/.exec(full.Text);
if (!match) {
  throw new Error('no 6-digit code in reset email');
}
output.otp = match[1];
