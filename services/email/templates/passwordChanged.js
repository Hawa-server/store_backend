/*
 * services/email/templates/passwordChanged.js
 *
 * "Your password was changed" (BE27), sent after a successful reset, so the
 * real owner notices if someone else changed it.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { contactLines } = require('./storeContact');

/*
 * passwordChangedEmail({ name, when })
 * Receives: the user's name and the time of the change, already in Ghana time.
 * Returns: { subject, html, text }.
 */
function passwordChangedEmail({ name, when }) {
  const subject = 'Your Adorn password was changed';
  const contact = contactLines();

  const text = [
    `Hi ${name},`,
    '',
    `Your password was changed on ${when} (Ghana time).`,
    'For your safety, you have been logged out on every device. Log in again with your new password.',
    '',
    "If this wasn't you, reset your password again straight away and contact us.",
    ...(contact.length ? ['', ...contact] : []),
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your password was changed on <strong>${escapeHtml(when)}</strong> (Ghana time).</p>
    <p>For your safety, you have been logged out on every device. Log in again with your new password.</p>
    <p><strong>If this wasn't you</strong>, reset your password again straight away and contact us.</p>
    ${contact.length ? `<p>${contact.map(escapeHtml).join('<br>')}</p>` : ''}
  `;

  return { subject, html, text };
}

module.exports = passwordChangedEmail;
