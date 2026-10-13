/*
 * Seeder: delivery regions and towns (BE24).
 *
 * Ghana's 16 regions, each with its capital (and a few more towns) as a
 * starting list. The store ships from Kumasi, so nearer regions cost less.
 *
 * THESE FEES ARE STARTING EXAMPLES. The store owner should check them and
 * change them in the admin (PATCH /api/admin/delivery-regions/:id and
 * /api/admin/delivery-towns/:id); that never affects orders already placed.
 *
 * Fees are whole pesewas: 1500 = GH₵ 15.00. A town's fee of null means
 * "use the region's fee" (e.g. Obuasi pays Ashanti's GH₵ 15, while Kumasi,
 * local delivery, pays its own GH₵ 10).
 *
 * Safe to run twice: regions and towns that already exist (by name) are
 * skipped, never duplicated or overwritten, so it can be run on production
 * after the store owner has changed fees:
 *   npm run seed:production -- 20261012000001-delivery-areas.js
 */
'use strict';

// [region name, region fee (pesewas), [[town name, own fee or null], ...]]
// The list order is the order shown at checkout (sortOrder 1, 2, 3...).
const REGIONS = [
  ['Ashanti', 1500, [['Kumasi', 1000], ['Obuasi', null]]],
  ['Bono', 2500, [['Sunyani', null]]],
  ['Bono East', 2500, [['Techiman', null]]],
  ['Ahafo', 2500, [['Goaso', null]]],
  ['Eastern', 2000, [['Koforidua', null]]],
  ['Greater Accra', 2000, [['Accra', null], ['Tema', null]]],
  ['Central', 2500, [['Cape Coast', null]]],
  ['Western', 3000, [['Sekondi-Takoradi', null]]],
  ['Western North', 3500, [['Sefwi Wiawso', null]]],
  ['Volta', 3000, [['Ho', null]]],
  ['Oti', 4000, [['Dambai', null]]],
  ['Northern', 5000, [['Tamale', null]]],
  ['Savannah', 5000, [['Damongo', null]]],
  ['North East', 5500, [['Nalerigu', null]]],
  ['Upper East', 6000, [['Bolgatanga', null]]],
  ['Upper West', 6000, [['Wa', null]]],
];

/*
 * regionIdsByName(queryInterface)
 * Receives: the seeder's queryInterface.
 * Returns: a Map of region name → id for every region in the database.
 */
async function regionIdsByName(queryInterface) {
  const [rows] = await queryInterface.sequelize.query('SELECT id, name FROM DeliveryRegions');
  return new Map(rows.map((row) => [row.name, row.id]));
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Regions: add only the ones that don't exist yet.
    const existing = await regionIdsByName(queryInterface);
    const newRegions = REGIONS.map(([name, feePesewas], index) => ({ name, feePesewas, sortOrder: index + 1 }))
      .filter((region) => !existing.has(region.name));
    if (newRegions.length) {
      await queryInterface.bulkInsert(
        'DeliveryRegions',
        newRegions.map((region) => ({ ...region, isActive: true, createdAt: now, updatedAt: now }))
      );
    }

    // Towns: look the region ids up by name (never assume an id), then add
    // only the towns that region doesn't have yet.
    const regionIds = await regionIdsByName(queryInterface);
    const [townRows] = await queryInterface.sequelize.query('SELECT regionId, name FROM DeliveryTowns');
    const haveTown = new Set(townRows.map((town) => `${town.regionId}|${town.name}`));
    const newTowns = [];
    for (const [regionName, , towns] of REGIONS) {
      const regionId = regionIds.get(regionName);
      for (const [name, feePesewas] of towns) {
        if (!haveTown.has(`${regionId}|${name}`)) {
          newTowns.push({ regionId, name, feePesewas, isActive: true, createdAt: now, updatedAt: now });
        }
      }
    }
    if (newTowns.length) await queryInterface.bulkInsert('DeliveryTowns', newTowns);

    console.log(`[seed] delivery areas: ${newRegions.length} regions and ${newTowns.length} towns added.`);
  },

  async down(queryInterface) {
    // Remove only areas NO checkout or order points at. Areas used by orders
    // must stay (the foreign keys are RESTRICT), just like products.
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q(`DELETE t FROM DeliveryTowns t
             WHERE NOT EXISTS (SELECT 1 FROM Checkouts c WHERE c.deliveryTownId = t.id)
               AND NOT EXISTS (SELECT 1 FROM Orders o WHERE o.deliveryTownId = t.id)`);
    await q(`DELETE r FROM DeliveryRegions r
             WHERE NOT EXISTS (SELECT 1 FROM DeliveryTowns t WHERE t.regionId = r.id)
               AND NOT EXISTS (SELECT 1 FROM Checkouts c WHERE c.deliveryRegionId = r.id)
               AND NOT EXISTS (SELECT 1 FROM Orders o WHERE o.deliveryRegionId = r.id)`);
  },
};
