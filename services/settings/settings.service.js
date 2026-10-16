/*
 * services/settings/settings.service.js
 *
 * The ONLY place that reads and writes the Settings table.
 * Settings are stored as text (key/value), so this service turns each one into
 * the right type and checks it's valid before anyone uses it.
 *
 *   deliveryFee        whole pesewas (e.g. 2000 = GHS 20.00)   NO LONGER USED by
 *                      checkout: since BE24 the fee depends on the delivery
 *                      area (services/delivery). Kept in the table for old seeds.
 *   usdRate            GHS per 1 USD, display only             used by BE13 (currency)
 *   lowStockThreshold  whole number                            used by BE20
 *   announcement…      the announcement bar (BE30): enabled, message, the
 *                      linked discount code's id, and an end day. Missing
 *                      keys mean "off" (they're created the first time the
 *                      admin saves), so no seeder is needed.
 */
const { sequelize, Setting } = require('../../models');

/*
 * getSetting(key)
 * Receives: the setting's key, e.g. 'deliveryFee'.
 * Returns: its stored text value.
 * Throws: an Error if the setting is missing. That's a setup problem (seeders
 *         not run), so it becomes a 500 and is logged, rather than silently
 *         charging a wrong amount.
 */
async function getSetting(key) {
  const row = await Setting.findOne({ where: { key } });
  if (!row) throw new Error(`Setting "${key}" is missing. Run the seeders.`);
  return row.value;
}

/*
 * getDeliveryFee()
 * Receives: nothing.
 * Returns: the old flat delivery fee in whole pesewas (an integer, never a decimal).
 * Not used by checkout any more (BE24 fees come from the delivery areas).
 */
async function getDeliveryFee() {
  const value = Number(await getSetting('deliveryFee'));
  // Money must be a whole, non-negative number of pesewas.
  if (!Number.isInteger(value) || value < 0) throw new Error('Setting "deliveryFee" must be a whole number of pesewas.');
  return value;
}

/*
 * getUsdRate()
 * Receives: nothing.
 * Returns: { usdRate, pesewasPerUsd }, e.g. { usdRate: 15.5, pesewasPerUsd: 1550 }.
 *          usdRate is how many cedis make 1 US dollar (for showing to people);
 *          pesewasPerUsd is the same rate as a whole number, used for the
 *          integer-only maths in utils/currency.js.
 * Throws: an Error if the stored value isn't a positive number with at most 2
 *         decimals (a setup problem: better a logged 500 than wrong prices).
 */
async function getUsdRate() {
  const text = String(await getSetting('usdRate')).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Setting "usdRate" must be a number like 15.50.');
  // "15.5" → ["15", "5"] → 15 × 100 + 50 = 1550. Done with text, not floats,
  // so the rate is exact.
  const [whole, fraction = ''] = text.split('.');
  const pesewasPerUsd = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (pesewasPerUsd <= 0) throw new Error('Setting "usdRate" must be greater than 0.');
  return { usdRate: pesewasPerUsd / 100, pesewasPerUsd };
}

const THRESHOLD_MAX = 1000;

/*
 * getLowStockThreshold()
 * Receives: nothing.
 * Returns: the low-stock threshold, a whole number from 0 to 1,000 (BE20).
 *          Products with stock from 1 up to this number count as "low stock".
 */
async function getLowStockThreshold() {
  const value = Number(await getSetting('lowStockThreshold'));
  if (!Number.isInteger(value) || value < 0 || value > THRESHOLD_MAX) {
    throw new Error('Setting "lowStockThreshold" must be a whole number from 0 to 1000.');
  }
  return value;
}

/*
 * setLowStockThreshold(value)
 * Receives: a whole number from 0 to 1,000 (already validated by Zod).
 * Returns: the saved value. Creates the setting if it's somehow missing.
 * Settings are stored as text, so the number is saved as a string.
 */
async function setLowStockThreshold(value) {
  const [updated] = await Setting.update({ value: String(value) }, { where: { key: 'lowStockThreshold' } });
  if (!updated) await Setting.create({ key: 'lowStockThreshold', value: String(value) });
  return value;
}


// The announcement bar's four keys (BE30), and their values when not set yet.
const ANNOUNCEMENT_KEYS = {
  enabled: 'announcementEnabled',
  message: 'announcementMessage',
  codeId: 'announcementCodeId',
  endsAt: 'announcementEndsAt',
};

/*
 * getAnnouncementSettings()
 * Receives: nothing.
 * Returns: { enabled (boolean), message (string), codeId (number or null),
 *          endsAt ('YYYY-MM-DD' or null) }. The Settings table stores text,
 *          so this is where "true", "12" or "" become real values. A key that
 *          doesn't exist yet counts as its default (off, empty), instead of
 *          throwing like the older settings: the bar is optional.
 */
async function getAnnouncementSettings() {
  const rows = await Setting.findAll({ where: { key: Object.values(ANNOUNCEMENT_KEYS) } });
  const text = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const codeId = Number(text[ANNOUNCEMENT_KEYS.codeId]);
  const endsAt = text[ANNOUNCEMENT_KEYS.endsAt];
  return {
    enabled: text[ANNOUNCEMENT_KEYS.enabled] === 'true',
    message: text[ANNOUNCEMENT_KEYS.message] || '',
    codeId: Number.isInteger(codeId) && codeId > 0 ? codeId : null,
    endsAt: /^\d{4}-\d{2}-\d{2}$/.test(endsAt || '') ? endsAt : null,
  };
}

/*
 * saveAnnouncementSettings({ enabled, message, codeId, endsAt })
 * Receives: already validated values (see announcement.service.js).
 * Returns: nothing. Saves all four as text, in ONE transaction (all or none),
 *          creating any key that doesn't exist yet.
 */
async function saveAnnouncementSettings({ enabled, message, codeId, endsAt }) {
  const values = {
    [ANNOUNCEMENT_KEYS.enabled]: enabled ? 'true' : 'false',
    [ANNOUNCEMENT_KEYS.message]: message || '',
    [ANNOUNCEMENT_KEYS.codeId]: codeId ? String(codeId) : '',
    [ANNOUNCEMENT_KEYS.endsAt]: endsAt || '',
  };
  await sequelize.transaction(async (transaction) => {
    for (const [key, value] of Object.entries(values)) {
      const [updated] = await Setting.update({ value }, { where: { key }, transaction });
      if (!updated) {
        const exists = await Setting.findOne({ where: { key }, attributes: ['id'], transaction });
        if (!exists) await Setting.create({ key, value }, { transaction });
      }
    }
  });
}

module.exports = {
  getSetting, getDeliveryFee, getUsdRate, getLowStockThreshold, setLowStockThreshold,
  getAnnouncementSettings, saveAnnouncementSettings,
};
