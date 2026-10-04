/*
 * Migration: Products table.
 * Money: priceGhs is whole pesewas (GHS 350.00 → 35000), never a decimal.
 * Stock: UNSIGNED, so the database itself refuses a negative stock value —
 * a last safety net behind the row locks and stock checks in the services.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Categories', key: 'id' },
        // A category with products can't be deleted by accident.
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      priceGhs: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      // Products are deactivated rather than deleted once orders reference them.
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Browsing by category is the most common product query.
    await queryInterface.addIndex('Products', ['categoryId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Products');
  },
};
