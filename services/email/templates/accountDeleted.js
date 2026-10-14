/*
 * services/email/templates/accountDeleted.js
 *
 * "Your Adorn account has been deleted" (BE27). Sent to the REAL address the
 * account had, captured before the account's email was replaced.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { contactLines } = require('./storeContact');

/*
 * accountDeletedEmail({ name })
 * Receives: the name the account had.
 * Returns: { subject, html, text }.
 */
function accountDeletedEmail({ name }) {
  const subject = 'Your Adorn account has been deleted';
  const contact = contactLines();

  const text = [
    `Hi ${name},`,
    '',
    'Your Adorn account has been deleted, as you asked. Your login, reviews and cart have been removed.',
    'Records of past orders are kept for the store\'s accounts, but they are no longer linked to any account you can log in to.',
    '',
    'You can create a new account with this email address at any time.',
    "If you didn't delete your account, contact us straight away.",
    ...(contact.length ? ['', ...contact] : []),
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your Adorn account has been deleted, as you asked. Your login, reviews and cart have been removed.</p>
    <p>Records of past orders are kept for the store's accounts, but they are no longer linked to any account you can log in to.</p>
    <p>You can create a new account with this email address at any time.</p>
    <p>If you didn't delete your account, contact us straight away.</p>
    ${contact.length ? `<p>${contact.map(escapeHtml).join('<br>')}</p>` : ''}
  `;

  return { subject, html, text };
}

module.exports = accountDeletedEmail;
