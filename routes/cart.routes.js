/*
 * routes/cart.routes.js
 *
 * Cart URLs, mounted at /api/cart in app.js. Works for guests and logged-in
 * users alike: optionalAuth sets req.user when someone is logged in.
 */
const express = require('express');
const controller = require('../controllers/cart.controller');
const validate = require('../middleware/validate');
const optionalAuth = require('../middleware/optionalAuth');
const { addItemBody, cartItemParams, updateItemBody } = require('../validators/cart.validators');

const router = express.Router();

router.get('/', optionalAuth, controller.getCart);
router.post('/items', optionalAuth, validate({ body: addItemBody }), controller.addItem);
// :id is the cart LINE id; the service only finds it inside the current shopper's cart.
router.patch('/items/:id', optionalAuth, validate({ params: cartItemParams, body: updateItemBody }), controller.updateItem);
router.delete('/items/:id', optionalAuth, validate({ params: cartItemParams }), controller.removeItem);

module.exports = router;
