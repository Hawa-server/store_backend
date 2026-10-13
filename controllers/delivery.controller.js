/*
 * controllers/delivery.controller.js
 *
 * Handles the HTTP side of GET /api/delivery-areas (BE24): the regions and
 * towns a shopper can choose at checkout, with each one's fee.
 */
const deliveryService = require('../services/delivery/delivery.service');

/*
 * GET /api/delivery-areas
 * Receives: nothing.
 * Returns: 200 { regions } (active regions and towns, with fees in pesewas
 *          and US cents).
 */
async function listAreas(req, res) {
  const areas = await deliveryService.listPublicAreas();
  // The same for every visitor and rarely changes, so browsers may reuse it
  // for 5 minutes. Checkout always works out the fee again on the server, so
  // a slightly old list can never change what's charged.
  res.set('Cache-Control', 'public, max-age=300');
  res.json(areas);
}

module.exports = { listAreas };
