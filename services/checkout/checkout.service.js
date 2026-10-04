/*
 * services/checkout/checkout.service.js
 *
 * Starts a payment for the shopper's current cart (BE7).
 *
 * Steps:
 *   1. Find the shopper's cart and recheck every line (still sold, enough stock).
 *   2. Calculate subtotal, delivery fee and total on the server, in pesewas.
 *   3. Save a Checkout row (status 'open') with a unique reference, plus a
 *      CheckoutItems snapshot of the lines being paid for.
 *   4. AFTER saving, ask Paystack to start a GHS mobile-money payment for that total.
 *
 * The response also shows USD amounts (BE13), but they're only a guide:
 * Paystack always charges the GHS total, and the response says so.
 *
 * No order is created here and stock isn't reduced: that only happens once
 * Paystack confirms the payment (BE8/BE9). The cart is also kept until then,
 * so a failed or abandoned payment loses nothing.
 */
const crypto = require('crypto');
const { sequelize, Checkout, CheckoutItem, CartItem, Product } = require('../../models');
const AppError = require('../../utils/AppError');
const cartService = require('../cart/cart.service');
const settingsService = require('../settings/settings.service');
const paystack = require('../payment/paystack.client');
const { toUsdCents } = require('../../utils/currency');
const { formatGhs } = require('../../utils/money');

/*
 * createReference()
 * Receives: nothing.
 * Returns: a unique, hard-to-guess payment reference such as
 *          "STORE-mg7x2k1a-4f9a1c2b8e3d". Paystack allows only letters,
 *          numbers and - . = in references.
 */
function createReference() {
  return `STORE-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

/*
 * priceCart(cart)
 * Receives: the shopper's Cart (or null).
 * Returns: { lines, subtotal } using CURRENT product prices from the database.
 *          `lines` is [{ productId, productName, unitPrice, quantity }]: the
 *          snapshot saved as CheckoutItems, from which the order is later built.
 * Throws: 400 if the cart is empty; 409 OUT_OF_STOCK if any product has been
 *         removed from the shop or doesn't have enough stock left.
 */
async function priceCart(cart) {
  const items = cart
    ? await CartItem.findAll({ where: { cartId: cart.id }, include: [{ model: Product }], order: [['id', 'ASC']] })
    : [];
  if (!items.length) throw new AppError(400, 'INVALID_REQUEST', 'Your cart is empty.');

  let subtotal = 0;
  const lines = [];
  for (const item of items) {
    const product = item.Product;
    if (!product.isActive) {
      throw new AppError(409, 'OUT_OF_STOCK', `${product.name} is no longer available. Please remove it from your cart.`);
    }
    // Stock is only checked here, not reserved. BE9 checks again, under a lock,
    // when the payment is confirmed.
    if (product.stock < item.quantity) {
      const message = product.stock === 0
        ? `${product.name} is out of stock. Please remove it from your cart.`
        : `Only ${product.stock} of ${product.name} available. Please update your cart.`;
      throw new AppError(409, 'OUT_OF_STOCK', message);
    }
    // Whole pesewas × whole quantity: exact, no rounding.
    subtotal += product.priceGhs * item.quantity;
    lines.push({ productId: product.id, productName: product.name, unitPrice: product.priceGhs, quantity: item.quantity });
  }
  return { lines, subtotal };
}

/*
 * startCheckout({ user, guestToken, details })
 * Receives: the logged-in user (or null for guests), the guest cart token (or
 *           null), and the validated { name, email, phone, address }.
 * Returns: { reference, accessCode, authorizationUrl, subtotalGhs,
 *            deliveryFeeGhs, totalGhs, currency, subtotalUsd, deliveryFeeUsd,
 *            totalUsd, usdRate, chargeNote } for the frontend to open
 *          Paystack's payment popup (accessCode) or page (authorizationUrl).
 * Throws: 400/409 from priceCart; 502 PAYMENT_FAILED if Paystack can't start
 *         the payment (the checkout is then marked 'failed').
 */
async function startCheckout({ user, guestToken, details }) {
  const cart = await cartService.findCart({ user, guestToken });

  // The money is calculated here, from the database. Nothing the client sent
  // about prices or totals is used (the validator dropped it anyway).
  const { lines, subtotal } = await priceCart(cart);
  const deliveryFee = await settingsService.getDeliveryFee();
  const total = subtotal + deliveryFee;
  // Read the USD rate now, before anything is saved or sent to Paystack, so a
  // broken rate setting can't leave a half-started payment behind.
  const { usdRate, pesewasPerUsd } = await settingsService.getUsdRate();

  // Save the checkout AND a snapshot of its items together (both or neither).
  // The order is later built from these items, not from the cart, so the
  // shopper gets exactly what they paid for even if the cart changes meanwhile.
  // The transaction is committed before we contact Paystack.
  const checkout = await sequelize.transaction(async (transaction) => {
    const created = await Checkout.create(
      {
        reference: createReference(),
        cartId: cart.id,
        userId: user ? user.id : null,
        ...details,
        subtotal,
        deliveryFee,
        total,
        status: 'open',
      },
      { transaction }
    );
    await CheckoutItem.bulkCreate(
      lines.map((line) => ({ ...line, checkoutId: created.id })),
      { transaction }
    );
    return created;
  });

  // Now call Paystack, outside any transaction.
  let paystackData;
  try {
    paystackData = await paystack.initializeTransaction({
      email: checkout.email,
      amount: checkout.total, // pesewas, as Paystack expects
      reference: checkout.reference,
      callbackUrl: `${process.env.CLIENT_URL}/checkout/complete`,
      metadata: { checkoutId: checkout.id },
    });
  } catch (err) {
    // Record that this attempt went nowhere. The shopper can simply try again,
    // which creates a new checkout with a new reference.
    await checkout.update({ status: 'failed' });
    console.error(`[checkout] Paystack initialize failed for ${checkout.reference}:`, err.message);
    throw new AppError(502, 'PAYMENT_FAILED', "We couldn't start the payment. Please try again.");
  }

  return {
    reference: checkout.reference,
    accessCode: paystackData.access_code,
    authorizationUrl: paystackData.authorization_url,
    subtotalGhs: checkout.subtotal,
    deliveryFeeGhs: checkout.deliveryFee,
    totalGhs: checkout.total,
    currency: 'GHS',
    // USD (display only, cents). Same rule as the cart: convert each UNIT
    // price, then multiply and add, so these add up exactly on screen.
    ...usdAmounts(lines, deliveryFee, pesewasPerUsd),
    usdRate,
    chargeNote: `You will be charged ${formatGhs(checkout.total)}. USD amounts are an estimate for display only.`,
  };
}

/*
 * usdAmounts(lines, deliveryFee, pesewasPerUsd)
 * Receives: the priced lines (unitPrice in pesewas, quantity), the delivery
 *           fee in pesewas, and the rate as pesewas per dollar.
 * Returns: { subtotalUsd, deliveryFeeUsd, totalUsd } in whole cents, where
 *          totalUsd is always exactly subtotalUsd + deliveryFeeUsd.
 */
function usdAmounts(lines, deliveryFee, pesewasPerUsd) {
  const subtotalUsd = lines.reduce((sum, line) => sum + toUsdCents(line.unitPrice, pesewasPerUsd) * line.quantity, 0);
  const deliveryFeeUsd = toUsdCents(deliveryFee, pesewasPerUsd);
  return { subtotalUsd, deliveryFeeUsd, totalUsd: subtotalUsd + deliveryFeeUsd };
}

module.exports = { startCheckout };
