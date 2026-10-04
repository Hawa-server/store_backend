/*
 * services/email/templates/orderShipped.js
 *
 * "Your order is on its way", sent when an admin marks an order Shipped
 * (BE15). No images, with a plain-text version, so it reads well everywhere.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { contactLines } = require('./storeContact');

/*
 * orderShippedEmail({ order, link })
 * Receives: the order view (order.service.js toConfirmationView) and the link
 *           to the order (My Orders for account holders, the confirmation
 *           page for guests).
 * Returns: { subject, html, text }.
 */
function orderShippedEmail({ order, link }) {
  const subject = `Your order ${order.orderNumber} is on its way`;
  const contact = contactLines();
  const items = order.items.map((item) => `${item.name} x ${item.quantity}`);
  const address = [order.delivery.name, order.delivery.phone, order.delivery.address];

  const text = [
    `Hi ${order.delivery.name},`,
    '',
    `Good news! Your order ${order.orderNumber} has been shipped and is on its way.`,
    '',
    'Items:',
    ...items.map((line) => `- ${line}`),
    '',
    'Delivering to:',
    ...address,
    '',
    `View your order: ${link}`,
    '',
    ...(contact.length ? ['Questions? Contact us:', ...contact] : []),
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px;">
      <p>Hi ${escapeHtml(order.delivery.name)},</p>
      <p>Good news! Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been shipped and is on its way.</p>
      <p><strong>Items:</strong><br>${items.map(escapeHtml).join('<br>')}</p>
      <p><strong>Delivering to:</strong><br>${address.map(escapeHtml).join('<br>')}</p>
      <p><a href="${escapeHtml(link)}">View your order</a></p>
      ${contact.length ? `<p>Questions? Contact us:<br>${contact.map(escapeHtml).join('<br>')}</p>` : ''}
    </div>
  `;

  return { subject, html, text };
}

module.exports = orderShippedEmail;
