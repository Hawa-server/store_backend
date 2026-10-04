/*
 * controllers/cart.controller.js
 *
 * Handles the HTTP side of /api/cart: works out who is asking (logged-in user
 * from optionalAuth, or the guest cookie), calls the cart service, and manages
 * the guest cookie.
 */
const cartService = require('../services/cart/cart.service');
const { readGuestCartToken, setGuestCartCookie, clearGuestCartCookie } = require('../utils/guestCartCookie');

/*
 * syncGuestCookie(req, res, cart)
 * Receives: the request, the response, and the cart that was used (or null).
 * Returns: nothing. For guests with a cart, sets or renews the 30-day cookie.
 *          If a guest's cookie pointed to a cart that no longer exists, clears it.
 *          Logged-in users don't need the guest cookie, so it's left alone for BE6.
 */
function syncGuestCookie(req, res, cart) {
  if (req.user) return;
  if (cart) setGuestCartCookie(res, cart.guestToken);
  else if (req.cookies.guestCart) clearGuestCartCookie(res);
}

/*
 * GET /api/cart
 * Receives: req.user (or null) and the guest cookie.
 * Returns: 200 { cart }. With no cart yet, an empty cart (nothing is created).
 */
async function getCart(req, res) {
  const { cart, view } = await cartService.getCart({ user: req.user, guestToken: readGuestCartToken(req) });
  syncGuestCookie(req, res, cart);
  res.json({ cart: view });
}

/*
 * POST /api/cart/items
 * Receives: req.valid.body = { productId, quantity }, plus req.user or the guest cookie.
 * Returns: 200 { cart } with the updated cart. Creates the cart (and the guest
 *          cookie) on the first add.
 */
async function addItem(req, res) {
  const { cart, view } = await cartService.addItem({
    user: req.user,
    guestToken: readGuestCartToken(req),
    ...req.valid.body,
  });
  syncGuestCookie(req, res, cart);
  res.json({ cart: view });
}

/*
 * PATCH /api/cart/items/:id
 * Receives: req.valid.params = { id } (the cart line id) and
 *           req.valid.body = { quantity } (0–99; 0 removes the line).
 * Returns: 200 { cart }, plus `message` when the server capped the quantity
 *          to the stock or removed a sold-out line.
 */
async function updateItem(req, res) {
  const { cart, view, message } = await cartService.updateItemQuantity({
    user: req.user,
    guestToken: readGuestCartToken(req),
    itemId: req.valid.params.id,
    quantity: req.valid.body.quantity,
  });
  syncGuestCookie(req, res, cart);
  res.json(message ? { cart: view, message } : { cart: view });
}

/*
 * DELETE /api/cart/items/:id
 * Receives: req.valid.params = { id } (the cart line id).
 * Returns: 200 { cart } with the line removed.
 */
async function removeItem(req, res) {
  const { cart, view } = await cartService.removeItem({
    user: req.user,
    guestToken: readGuestCartToken(req),
    itemId: req.valid.params.id,
  });
  syncGuestCookie(req, res, cart);
  res.json({ cart: view });
}

module.exports = { getCart, addItem, updateItem, removeItem };
