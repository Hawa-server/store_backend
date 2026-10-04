/*
 * Migration: Settings table.
 * Simple key/value store for values an admin may change without a code deploy:
 *   usdRate (GHS per 1 USD), deliveryFee (pesewas), lowStockThreshold.
 * Values are stored as text and converted by the settings service.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      key: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      value: { type: Sequelize.STRING(255), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Settings');
  },
};
