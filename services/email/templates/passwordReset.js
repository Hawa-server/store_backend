/*
 * services/email/templates/passwordReset.js
 *
 * The "reset your password" message (BE27), sent after "Forgot password".
 * Returns { subject, html, text } like every template.
 */
const escapeHtml = require('../../../utils/escapeHtml');

/*
 * passwordResetEmail({ name, link, minutes })
 * Receives: the user's name, the full reset link, and how many minutes it works.
 * Returns: { subject, html, text }.
 */
function passwordResetEmail({ name, link, minutes }) {
  const subject = 'Reset your Adorn password';

  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your password. Choose a new one by opening this link:',
    link,
    '',
    `The link works once and expires in ${minutes} minutes.`,
    "If you didn't ask for this, ignore this email: your password stays the same.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your password. Choose a new one here:</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">Reset my password</a></p>
    <p>Or copy this link into your browser:<br>${escapeHtml(link)}</p>
    <p>The link works once and expires in ${minutes} minutes.</p>
    <p>If you didn't ask for this, ignore this email: your password stays the same.</p>
  `;

  return { subject, html, text };
}

module.exports = passwordResetEmail;
