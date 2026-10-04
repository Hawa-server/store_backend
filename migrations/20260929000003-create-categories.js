/*
 * Migration: Categories table.
 * Bags, Makeup, Jewellery, Accessories. `slug` is the URL-friendly name used in
 * ?category=bags; `sortOrder` controls the display order.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Categories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(50), allowNull: false },
      slug: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Categories');
  },
};
