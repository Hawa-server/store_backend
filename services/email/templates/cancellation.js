/*
 * services/email/templates/cancellation.js
 *
 * "Your order has been cancelled", sent after a shopper or admin cancels an
 * order (BE16). Says how much is being refunded and roughly how long it
 * takes. If nothing was left to refund (it had already been refunded), the
 * refund lines are left out.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { formatGhs } = require('../../../utils/money');
const { contactLines } = require('./storeContact');

const TIMING = 'Refunds usually take a few business days to reach your mobile money wallet.';

/*
 * cancellationEmail({ order, link, refundAmount })
 * Receives: the order view (order.service.js toConfirmationView), the link to
 *           the order, and the refund amount in pesewas (0 = no new refund).
 * Returns: { subject, html, text }.
 */
function cancellationEmail({ order, link, refundAmount }) {
  const subject = `Your order ${order.orderNumber} has been cancelled`;
  const contact = contactLines();
  const items = order.items.map((item) => `${item.name} x ${item.quantity}`);
  const refundLines = refundAmount > 0 ? [`Refund: ${formatGhs(refundAmount)}`, TIMING] : [];

  const text = [
    `Hi ${order.delivery.name},`,
    '',
    `Your order ${order.orderNumber} has been cancelled.`,
    '',
    'Cancelled items:',
    ...items.map((line) => `- ${line}`),
    '',
    ...(refundLines.length ? [...refundLines, ''] : []),
    `View your order: ${link}`,
    '',
    ...(contact.length ? ['Questions? Contact us:', ...contact] : []),
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px;">
      <p>Hi ${escapeHtml(order.delivery.name)},</p>
      <p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been cancelled.</p>
      <p><strong>Cancelled items:</strong><br>${items.map(escapeHtml).join('<br>')}</p>
      ${refundAmount > 0
        ? `<p><strong>Refund: ${escapeHtml(formatGhs(refundAmount))}</strong><br>${escapeHtml(TIMING)}</p>`
        : ''}
      <p><a href="${escapeHtml(link)}">View your order</a></p>
      ${contact.length ? `<p>Questions? Contact us:<br>${contact.map(escapeHtml).join('<br>')}</p>` : ''}
    </div>
  `;

  return { subject, html, text };
}

module.exports = cancellationEmail;
