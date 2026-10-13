/*
 * services/delivery/adminDelivery.service.js
 *
 * Admin management of delivery areas (BE24): see every region and town
 * (hidden ones too), change fees, add towns, and hide or show them.
 * Reached only through /api/admin (requireAuth + requireAdmin).
 *
 * Rules:
 *   - No deletes. Checkouts and orders point at regions and towns (RESTRICT),
 *     so they're hidden with isActive = false: gone from checkout, still
 *     shown on past orders.
 *   - Regions aren't added or renamed here: Ghana's regions are fixed, and
 *     the seeder creates them.
 *   - At least one region always stays active, so checkout always has a choice.
 *   - Changing a fee never changes past orders: each order stores the fee it
 *     was charged (Orders.deliveryFee) and the area names at that time.
 */
const { UniqueConstraintError } = require('sequelize');
const { sequelize, DeliveryRegion, DeliveryTown } = require('../../models');
const AppError = require('../../utils/AppError');
const withDeadlockRetry = require('../../utils/withDeadlockRetry');
const { effectiveFee } = require('./delivery.service');

/*
 * toTownView(town, region)
 * Receives: a town and its region.
 * Returns: the admin view: the raw fee (null = uses the region's fee) and
 *          the fee that actually applies.
 */
function toTownView(town, region) {
  return {
    id: town.id,
    regionId: town.regionId,
    name: town.name,
    feePesewas: town.feePesewas,
    effectiveFeePesewas: effectiveFee(town, region),
    isActive: town.isActive,
    updatedAt: town.updatedAt,
  };
}

/*
 * toRegionView(region, towns)
 * Receives: a region and its towns. Returns: the admin view of the region.
 */
function toRegionView(region, towns) {
  return {
    id: region.id,
    name: region.name,
    feePesewas: region.feePesewas,
    sortOrder: region.sortOrder,
    isActive: region.isActive,
    updatedAt: region.updatedAt,
    towns: towns.map((town) => toTownView(town, region)),
  };
}

/*
 * listAll()
 * Receives: nothing.
 * Returns: { regions } — every region (by sortOrder, then name) with all its
 *          towns (A–Z), including hidden ones.
 */
async function listAll() {
  const regions = await DeliveryRegion.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
  const towns = await DeliveryTown.findAll({ order: [['name', 'ASC']] });
  return {
    regions: regions.map((region) => toRegionView(region, towns.filter((town) => town.regionId === region.id))),
  };
}

/*
 * updateRegion(id, changes, adminId)
 * Receives: the region id, the validated { feePesewas?, isActive? } and the
 *           admin's id.
 * Returns: the region's admin view (with its towns).
 * Throws: 404 unknown region; 409 when hiding the only active region.
 */
async function updateRegion(id, changes, adminId) {
  await withDeadlockRetry(() =>
    sequelize.transaction(async (transaction) => {
      // Lock ALL region rows (always in id order, to avoid deadlocks). Two
      // admins hiding the last two active regions at the same moment then
      // take turns, and the second one sees that only one is left.
      const regions = await DeliveryRegion.findAll({ order: [['id', 'ASC']], lock: transaction.LOCK.UPDATE, transaction });
      const region = regions.find((r) => r.id === id);
      if (!region) throw new AppError(404, 'NOT_FOUND', 'Delivery region not found.');

      if (changes.isActive === false && region.isActive) {
        const othersActive = regions.filter((r) => r.isActive && r.id !== id).length;
        if (othersActive === 0) {
          throw new AppError(409, 'CONFLICT', 'This is the only active region. Show another region before hiding this one.');
        }
      }

      const update = {};
      if (changes.feePesewas !== undefined) update.feePesewas = changes.feePesewas;
      if (changes.isActive !== undefined) update.isActive = changes.isActive;
      await region.update(update, { transaction });
    })
  );

  console.log(`[admin] admin ${adminId} updated delivery region ${id} (fields: ${Object.keys(changes).join(', ')})`);
  const region = await DeliveryRegion.findByPk(id);
  const towns = await DeliveryTown.findAll({ where: { regionId: id }, order: [['name', 'ASC']] });
  return toRegionView(region, towns);
}

/*
 * duplicateTownName(name)
 * Receives: the town name. Returns: the 409 error for a name the region
 *           already has (with fields.name, so the form can show it).
 */
function duplicateTownName(name) {
  return new AppError(409, 'CONFLICT', 'Please check the highlighted fields.', {
    name: `This region already has a town called "${name}".`,
  });
}

/*
 * saveTown(name, work)
 * Receives: the town name and an async function that saves the town.
 * Returns: its result. If the database's UNIQUE (regionId, name) rule refuses
 *          a duplicate (two admins adding the same town at the same instant),
 *          the answer is the same friendly 409, never a 500.
 */
async function saveTown(name, work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw duplicateTownName(name);
    throw err;
  }
}

/*
 * checkTownNameFree(regionId, name, exceptId, transaction)
 * Receives: the region, the town name, the id of the town being edited (or
 *           null). Returns: nothing. Throws the 409 if ANOTHER town in that
 *           region has the name. The column ignores case, so "tema" = "Tema".
 */
async function checkTownNameFree(regionId, name, exceptId, transaction) {
  const other = await DeliveryTown.findOne({ where: { regionId, name }, attributes: ['id'], transaction });
  if (other && other.id !== exceptId) throw duplicateTownName(name);
}

/*
 * createTown({ regionId, name, feePesewas }, adminId)
 * Receives: the validated body (feePesewas null = use the region's fee) and
 *           the admin's id.
 * Returns: the new town's admin view. A town can be added to a hidden
 *          region too (it appears once the region is shown again).
 * Throws: 400 (fields.regionId) unknown region; 409 (fields.name) duplicate.
 */
async function createTown({ regionId, name, feePesewas }, adminId) {
  const town = await saveTown(name, () =>
    sequelize.transaction(async (transaction) => {
      const region = await DeliveryRegion.findByPk(regionId, { transaction });
      if (!region) {
        throw new AppError(400, 'INVALID_REQUEST', 'Please check the highlighted fields.', { regionId: 'Choose a region.' });
      }
      await checkTownNameFree(regionId, name, null, transaction);
      return DeliveryTown.create({ regionId, name, feePesewas, isActive: true }, { transaction });
    })
  );

  console.log(`[admin] admin ${adminId} added delivery town ${town.id} to region ${regionId}`);
  return toTownView(town, await DeliveryRegion.findByPk(regionId));
}

/*
 * updateTown(id, changes, adminId)
 * Receives: the town id, the validated { name?, feePesewas? (null allowed:
 *           go back to the region's fee), isActive? } and the admin's id.
 * Returns: the town's admin view.
 * Throws: 404 unknown town; 409 (fields.name) duplicate name in its region.
 */
async function updateTown(id, changes, adminId) {
  await saveTown(changes.name, () =>
    sequelize.transaction(async (transaction) => {
      const town = await DeliveryTown.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });
      if (!town) throw new AppError(404, 'NOT_FOUND', 'Delivery town not found.');
      if (changes.name !== undefined) await checkTownNameFree(town.regionId, changes.name, id, transaction);

      // Only the fields that were sent. `!== undefined` (not a truthy check),
      // because feePesewas: null and isActive: false are real changes.
      const update = {};
      for (const field of ['name', 'feePesewas', 'isActive']) {
        if (changes[field] !== undefined) update[field] = changes[field];
      }
      await town.update(update, { transaction });
    })
  );

  console.log(`[admin] admin ${adminId} updated delivery town ${id} (fields: ${Object.keys(changes).join(', ')})`);
  const town = await DeliveryTown.findByPk(id, { include: [{ model: DeliveryRegion, as: 'region' }] });
  return toTownView(town, town.region);
}

module.exports = { listAll, updateRegion, createTown, updateTown };
