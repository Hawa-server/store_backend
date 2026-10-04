/*
 * routes/orders.routes.js
 *
 * Order URLs, mounted at /api/orders in app.js.
 *   /confirmation/:token  no login: the token is the key (BE11)
 *   /  and  /:id          My Orders: login required, own orders only (BE14)
 *   /:id/cancel           cancel your own Pending order (BE16)
 */
const express = require('express');
const controller = require('../controllers/order.controller');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { myOrdersQuery, orderIdParams } = require('../validators/order.validators');

const router = express.Router();

// No login: guests buy too. The 64-character random token IS the key, so it
// can't be guessed. Its format is checked in the service, and a bad one gets
// the same 404 as an unknown one.
router.get('/confirmation/:token', controller.getConfirmation);

router.get('/', requireAuth, validate({ query: myOrdersQuery }), controller.listMine);
router.get('/:id', requireAuth, validate({ params: orderIdParams }), controller.getMine);
router.post('/:id/cancel', requireAuth, validate({ params: orderIdParams }), controller.cancelMine);

module.exports = router;
