/*
 * services/email/templates/loginAlert.js
 *
 * Sent after every successful login, so users notice if someone else gets
 * into their account.
 */
const escapeHtml = require('../../../utils/escapeHtml');

/*
 * loginAlertEmail({ name, when, device })
 * Receives: the user's name, the login time already formatted in Ghana time,
 *           and a browser description such as "Chrome on Windows".
 * Returns: { subject, html, text }.
 */
function loginAlertEmail({ name, when, device }) {
  const subject = 'New login to your account';
  const advice =
    "If this wasn't you, change your password straight away and contact us, as someone else may know it.";

  const text = [
    `Hi ${name},`,
    '',
    'Your account was just logged in to.',
    `When: ${when}`,
    `Browser: ${device}`,
    '',
    "If this was you, there's nothing to do.",
    advice,
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your account was just logged in to.</p>
    <ul>
      <li><strong>When:</strong> ${escapeHtml(when)}</li>
      <li><strong>Browser:</strong> ${escapeHtml(device)}</li>
    </ul>
    <p>If this was you, there's nothing to do.</p>
    <p><strong>${escapeHtml(advice)}</strong></p>
  `;

  return { subject, html, text };
}

module.exports = loginAlertEmail;
