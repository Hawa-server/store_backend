/*
 * services/email/templates/verification.js
 *
 * The "verify your email" message sent after registration and on resend.
 * Every template returns { subject, html, text }: an HTML version for email
 * apps that show formatting, and plain text for those that don't.
 */
const escapeHtml = require('../../../utils/escapeHtml');

/*
 * verificationEmail({ name, link })
 * Receives: the user's name and the full verification link.
 * Returns: { subject, html, text }.
 */
function verificationEmail({ name, link }) {
  const subject = 'Verify your email address';

  const text = [
    `Hi ${name},`,
    '',
    'Thanks for creating an account. Please verify your email address by opening this link:',
    link,
    '',
    'The link works once and expires in 24 hours.',
    "If you didn't create an account, you can ignore this email.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thanks for creating an account. Please verify your email address:</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">Verify my email</a></p>
    <p>Or copy this link into your browser:<br>${escapeHtml(link)}</p>
    <p>The link works once and expires in 24 hours.</p>
    <p>If you didn't create an account, you can ignore this email.</p>
  `;

  return { subject, html, text };
}

module.exports = verificationEmail;
