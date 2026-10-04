/*
 * services/email/templates/orderConfirmation.js
 *
 * The "thank you, here's your order" email, sent once, straight after the
 * order is created (BE11). Built from the same data as the confirmation page,
 * so the two always agree. It has no images, so it reads well on phones and
 * in email apps that block images, and it includes a plain-text version.
 */
const escapeHtml = require('../../../utils/escapeHtml');
const { formatGhs } = require('../../../utils/money');
const { formatGhanaDateTime } = require('../../../utils/dates');
const { contactLines } = require('./storeContact');

/*
 * orderConfirmationEmail({ order, link, linkDays })
 * Receives: the confirmation view (order.service.js toConfirmationView), the
 *           confirmation page link, and how many days the link works.
 * Returns: { subject, html, text }.
 */
function orderConfirmationEmail({ order, link, linkDays }) {
  const subject = `Order confirmed: ${order.orderNumber}`;
  const placed = formatGhanaDateTime(order.placedAt);
  const contact = contactLines();
  const payment = 'Mobile money (Paystack)';

  const text = [
    `Hi ${order.delivery.name},`,
    '',
    `Thank you for your order! We've received your payment.`,
    '',
    `Order number: ${order.orderNumber}`,
    `Placed: ${placed}`,
    '',
    'Items:',
    ...order.items.map(
      (item) => `- ${item.name} x ${item.quantity} @ ${formatGhs(item.unitPriceGhs)} = ${formatGhs(item.lineTotalGhs)}`
    ),
    '',
    `Subtotal: ${formatGhs(order.subtotalGhs)}`,
    `Delivery: ${formatGhs(order.deliveryFeeGhs)}`,
    `Total paid: ${formatGhs(order.totalGhs)} (${order.currency})`,
    `Payment method: ${payment}`,
    '',
    'Delivering to:',
    order.delivery.name,
    order.delivery.phone,
    order.delivery.address,
    '',
    `View your order: ${link}`,
    `(This link works for ${linkDays} days. Keep it private: anyone with it can see your order.)`,
    '',
    ...(contact.length ? ['Questions? Contact us:', ...contact] : []),
  ].join('\n');

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${escapeHtml(item.name)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">${escapeHtml(formatGhs(item.unitPriceGhs))}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">${escapeHtml(formatGhs(item.lineTotalGhs))}</td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px;">
      <p>Hi ${escapeHtml(order.delivery.name)},</p>
      <p>Thank you for your order! We've received your payment.</p>
      <p><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}<br>
         <strong>Placed:</strong> ${escapeHtml(placed)}</p>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #222;">Item</th>
            <th style="padding:6px 8px;text-align:center;border-bottom:2px solid #222;">Qty</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #222;">Price</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #222;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;">
        Subtotal: ${escapeHtml(formatGhs(order.subtotalGhs))}<br>
        Delivery: ${escapeHtml(formatGhs(order.deliveryFeeGhs))}<br>
        <strong>Total paid: ${escapeHtml(formatGhs(order.totalGhs))} (${escapeHtml(order.currency)})</strong>
      </p>
      <p><strong>Payment method:</strong> ${escapeHtml(payment)}</p>
      <p><strong>Delivering to:</strong><br>
         ${escapeHtml(order.delivery.name)}<br>
         ${escapeHtml(order.delivery.phone)}<br>
         ${escapeHtml(order.delivery.address)}</p>
      <p><a href="${escapeHtml(link)}">View your order</a><br>
         <small>This link works for ${linkDays} days. Keep it private: anyone with it can see your order.</small></p>
      ${contact.length ? `<p>Questions? Contact us:<br>${contact.map(escapeHtml).join('<br>')}</p>` : ''}
    </div>
  `;

  return { subject, html, text };
}

module.exports = orderConfirmationEmail;
