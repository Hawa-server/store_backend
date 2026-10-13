/*
 * services/delivery/delivery.service.js
 *
 * Delivery areas for shoppers (BE24): the list shown at checkout, and working
 * out the fee for the area a shopper chose.
 *
 * How the fee works: the shopper picks a region, then a town from that
 * region's list or "Other town in this region" (no town). The fee is the
 * town's own fee if it has one, otherwise the region's fee.
 *   e.g. Ashanti GH₵ 15, Kumasi GH₵ 10 → Kumasi pays 10, Obuasi (no own fee) 15.
 *
 * The SERVER always works out the fee from the database. The browser only
 * says which region and town were chosen; any fee it sends is ignored.
 */
const { DeliveryRegion, DeliveryTown } = require('../../models');
const AppError = require('../../utils/AppError');
const settingsService = require('../settings/settings.service');
const { toUsdCents } = require('../../utils/currency');

/*
 * effectiveFee(town, region)
 * Receives: a town (or null for "Other town") and its region.
 * Returns: the fee that applies, in whole pesewas: the town's own fee if it
 *          has one (0 counts: free delivery), otherwise the region's.
 */
function effectiveFee(town, region) {
  return town && town.feePesewas !== null ? town.feePesewas : region.feePesewas;
}

/*
 * listPublicAreas()
 * Receives: nothing.
 * Returns: { regions } — the ACTIVE regions (by sortOrder, then name), each
 *          with its ACTIVE towns (A–Z) and every fee in pesewas (feeGhs) and
 *          US cents (feeUsd, display only). Hidden regions and towns are left
 *          out, so they can't be chosen at checkout.
 */
async function listPublicAreas() {
  const { pesewasPerUsd } = await settingsService.getUsdRate();
  const regions = await DeliveryRegion.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  });
  // All active towns in ONE query, then grouped by region.
  const towns = await DeliveryTown.findAll({
    where: { isActive: true, regionId: regions.map((region) => region.id) },
    order: [['name', 'ASC']],
  });

  const fee = (pesewas) => ({ feeGhs: pesewas, feeUsd: toUsdCents(pesewas, pesewasPerUsd) });
  return {
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name,
      ...fee(region.feePesewas),
      towns: towns
        .filter((town) => town.regionId === region.id)
        .map((town) => ({ id: town.id, name: town.name, ...fee(effectiveFee(town, region)) })),
    })),
  };
}

/*
 * resolveDeliveryArea({ regionId, townId })
 * Receives: the region id and town id from the checkout body (townId is
 *           undefined or null for "Other town in this region").
 * Returns: { regionId, townId, regionName, townName, fee } — what checkout
 *          saves. townId and townName are null for "Other town". fee is
 *          whole pesewas, worked out here from the database.
 * Throws: 400 with fields.deliveryRegionId if the region is unknown or hidden;
 *         400 with fields.deliveryTownId if the town is unknown, hidden, or
 *         belongs to a DIFFERENT region (e.g. Kumasi with Greater Accra,
 *         which could otherwise be used to pay Kumasi's cheaper fee).
 */
async function resolveDeliveryArea({ regionId, townId }) {
  const region = await DeliveryRegion.findByPk(regionId);
  if (!region || !region.isActive) {
    throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', {
      deliveryRegionId: 'Choose a delivery region.',
    });
  }

  let town = null;
  if (townId !== undefined && townId !== null) {
    town = await DeliveryTown.findByPk(townId);
    if (!town || !town.isActive || town.regionId !== region.id) {
      throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', {
        deliveryTownId: `Choose a town in ${region.name}, or "Other town in this region".`,
      });
    }
  }

  return {
    regionId: region.id,
    townId: town ? town.id : null,
    regionName: region.name,
    townName: town ? town.name : null,
    fee: effectiveFee(town, region),
  };
}

module.exports = { effectiveFee, listPublicAreas, resolveDeliveryArea };
