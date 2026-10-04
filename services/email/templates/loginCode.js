/*
 * services/email/templates/loginCode.js
 *
 * The email with the 6-digit login code (BE12), sent after someone enters the
 * right password while login codes are switched on.
 */
const escapeHtml = require('../../../utils/escapeHtml');

/*
 * loginCodeEmail({ name, code, minutes })
 * Receives: the user's name, the 6-digit code, and how many minutes it lasts.
 * Returns: { subject, html, text }.
 */
function loginCodeEmail({ name, code, minutes }) {
  // The code is NOT in the subject, so it doesn't show on a locked phone screen.
  const subject = 'Your login code';
  const warning =
    "If you didn't just try to log in, someone may know your password. Change it straight away, and don't share this code with anyone.";

  const text = [
    `Hi ${name},`,
    '',
    `Your login code is: ${code}`,
    '',
    `It expires in ${minutes} minutes and can only be used once.`,
    '',
    warning,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your login code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:12px 0;">${escapeHtml(code)}</p>
      <p>It expires in ${minutes} minutes and can only be used once.</p>
      <p><strong>${escapeHtml(warning)}</strong></p>
    </div>
  `;

  return { subject, html, text };
}

module.exports = loginCodeEmail;
