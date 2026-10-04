/*
 * Migration: OrderItems table.
 * The products in an order. productName and unitPrice are copies taken at the
 * time of purchase, so order history shows what the shopper actually paid even
 * if the product is renamed or its price changes later.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OrderItems', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        // Products that have been ordered can't be deleted (deactivate them instead).
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      productName: { type: Sequelize.STRING(150), allowNull: false },
      unitPrice: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      quantity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OrderItems');
  },
};
