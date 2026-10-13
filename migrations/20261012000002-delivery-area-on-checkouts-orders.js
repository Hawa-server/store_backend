/*
 * Migration: record WHERE each checkout and order is delivered (BE24).
 *
 * Adds to both Checkouts and Orders:
 *   deliveryRegionId, deliveryTownId    which area was chosen (foreign keys)
 *   deliveryRegionName, deliveryTownName  COPIES of the names at that moment
 *
 * All four are nullable, so existing rows stay valid: old orders were charged
 * the flat fee and simply have no area recorded. deliveryTownId is also NULL
 * when the shopper chose "Other town in this region".
 *
 * Why copy the names? A town can later be renamed or hidden; an old order
 * must still show where it was actually sent. (The fee itself is already
 * stored in deliveryFee, which never changes after checkout.)
 *
 * The foreign keys are RESTRICT, and named, so the "down" step can remove
 * them before dropping the columns (MySQL won't drop a column that a foreign
 * key still uses).
 */
'use strict';

const TABLES = [
  { table: 'Checkouts', prefix: 'checkouts' },
  { table: 'Orders', prefix: 'orders' },
];

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    for (const { table, prefix } of TABLES) {
      await q(`ALTER TABLE ${table}
               ADD COLUMN deliveryRegionId INT NULL AFTER address,
               ADD COLUMN deliveryTownId INT NULL AFTER deliveryRegionId,
               ADD COLUMN deliveryRegionName VARCHAR(80) NULL AFTER deliveryTownId,
               ADD COLUMN deliveryTownName VARCHAR(80) NULL AFTER deliveryRegionName`);
      await q(`ALTER TABLE ${table}
               ADD CONSTRAINT ${prefix}_delivery_region_fk FOREIGN KEY (deliveryRegionId)
                 REFERENCES DeliveryRegions (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
               ADD CONSTRAINT ${prefix}_delivery_town_fk FOREIGN KEY (deliveryTownId)
                 REFERENCES DeliveryTowns (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);
    }
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    for (const { table, prefix } of TABLES) {
      await q(`ALTER TABLE ${table}
               DROP FOREIGN KEY ${prefix}_delivery_region_fk,
               DROP FOREIGN KEY ${prefix}_delivery_town_fk`);
      await q(`ALTER TABLE ${table}
               DROP COLUMN deliveryRegionId,
               DROP COLUMN deliveryTownId,
               DROP COLUMN deliveryRegionName,
               DROP COLUMN deliveryTownName`);
    }
  },
};
