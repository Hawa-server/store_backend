/*
 * Migration: delivery areas (BE24).
 *
 * The flat delivery fee is replaced by a fee that depends on where the order
 * goes. The store ships from Kumasi, so nearer places cost less.
 *
 *   DeliveryRegions  Ghana's 16 regions, each with a fee (whole pesewas).
 *   DeliveryTowns    towns inside a region. A town MAY have its own fee;
 *                    feePesewas NULL means "use the region's fee".
 *
 * One region has many towns (DeliveryTowns.regionId → DeliveryRegions.id).
 * Nothing is ever deleted: orders point at regions and towns, so they're
 * hidden with isActive = false instead (the foreign keys are RESTRICT).
 *
 * Names ignore case (the column collation), so "kumasi" and "Kumasi" in the
 * same region count as the same town.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DeliveryRegions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      // Whole pesewas, 0 to 100,000 (GH₵ 0–1,000). 0 = free delivery there.
      feePesewas: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('DeliveryTowns', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      regionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DeliveryRegions', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      },
      name: { type: Sequelize.STRING(80), allowNull: false },
      // NULL = no fee of its own: the region's fee applies.
      feePesewas: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // A town name appears only once per region. The service checks first (for
    // a friendly 409); this index is the backstop if two admins save at once.
    await queryInterface.addIndex('DeliveryTowns', ['regionId', 'name'], {
      unique: true,
      name: 'delivery_towns_region_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DeliveryTowns');
    await queryInterface.dropTable('DeliveryRegions');
  },
};
