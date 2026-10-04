/*
 * services/email/templates/orderDelivered.js
 *
 * "Your order has been delivered", sent when an admin marks an order
 * Delivered (BE15). Shoppers with an account are invited to review what they
 * bought (reviews need an account, BE18); guests aren't.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { contactLines } = require('./storeContact');

/*
 * orderDeliveredEmail({ order, link, hasAccount })
 * Receives: the order view, the link to the order, and whether the shopper
 *           has an account (only they can leave reviews).
 * Returns: { subject, html, text }.
 */
function orderDeliveredEmail({ order, link, hasAccount }) {
  const subject = `Your order ${order.orderNumber} has been delivered`;
  const contact = contactLines();
  const items = order.items.map((item) => `${item.name} x ${item.quantity}`);
  const reviewNote = 'Enjoying your purchase? You can now review the products you bought from your order page.';

  const text = [
    `Hi ${order.delivery.name},`,
    '',
    `Your order ${order.orderNumber} has been delivered. We hope you love it!`,
    '',
    'Items:',
    ...items.map((line) => `- ${line}`),
    '',
    ...(hasAccount ? [reviewNote, ''] : []),
    `View your order: ${link}`,
    '',
    "If something isn't right, contact us and we'll help.",
    ...contact,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px;">
      <p>Hi ${escapeHtml(order.delivery.name)},</p>
      <p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been delivered. We hope you love it!</p>
      <p><strong>Items:</strong><br>${items.map(escapeHtml).join('<br>')}</p>
      ${hasAccount ? `<p>${escapeHtml(reviewNote)}</p>` : ''}
      <p><a href="${escapeHtml(link)}">View your order</a></p>
      <p>If something isn't right, contact us and we'll help.${contact.length ? `<br>${contact.map(escapeHtml).join('<br>')}` : ''}</p>
    </div>
  `;

  return { subject, html, text };
}

module.exports = orderDeliveredEmail;
