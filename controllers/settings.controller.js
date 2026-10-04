/*
 * controllers/settings.controller.js
 *
 * Public store settings the frontend needs. For now: the currency rules (BE13).
 */
const { getUsdRate } = require('../services/settings/settings.service');

/*
 * GET /api/settings/currency
 * Receives: nothing.
 * Returns: 200 { currency } — which currency is charged (always GHS), which
 *          can be displayed, and the current rate (GHS per 1 US dollar).
 */
async function getCurrency(req, res) {
  const { usdRate } = await getUsdRate();
  res.json({
    currency: {
      chargeCurrency: 'GHS',
      displayCurrencies: ['GHS', 'USD'],
      usdRate,
      note: 'Prices are charged in Ghana cedis (GHS). USD amounts are an estimate for display only.',
    },
  });
}

module.exports = { getCurrency };
