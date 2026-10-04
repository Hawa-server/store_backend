/*
 * services/email/templates/refund.js
 *
 * The "we're refunding you" email. Used when an item sold out after payment
 * (BE9), and later for cancellations (BE16) and admin refunds (BE17).
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { formatGhs } = require('../../../utils/money');

const TIMING = 'Refunds usually take a few business days to reach your mobile money wallet.';

/*
 * refundEmail({ name, amount, reason, reference })
 * Receives: the shopper's name, the refund amount in whole pesewas, a
 *           sentence explaining why, and the order number or payment reference.
 * Returns: { subject, html, text }.
 */
function refundEmail({ name, amount, reason, reference }) {
  const subject = `Your refund of ${formatGhs(amount)}`;

  const text = [
    `Hi ${name},`,
    '',
    reason,
    '',
    `Refund amount: ${formatGhs(amount)}`,
    `Reference: ${reference}`,
    '',
    TIMING,
    "If you don't receive it within 7 business days, reply to this email and we'll help.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>${escapeHtml(reason)}</p>
    <ul>
      <li><strong>Refund amount:</strong> ${escapeHtml(formatGhs(amount))}</li>
      <li><strong>Reference:</strong> ${escapeHtml(reference)}</li>
    </ul>
    <p>${escapeHtml(TIMING)}</p>
    <p>If you don't receive it within 7 business days, reply to this email and we'll help.</p>
  `;

  return { subject, html, text };
}

module.exports = refundEmail;
