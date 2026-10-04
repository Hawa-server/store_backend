/*
 * Migration: CheckoutItems table (added in BE8).
 *
 * A snapshot of exactly what was priced when a checkout started: which
 * products, how many, and at what price. The order is built from these rows
 * once payment is confirmed, NOT from the cart, because the cart can change
 * while the shopper is paying (or disappear, e.g. a guest cart merged at login).
 * This guarantees the shopper receives exactly what they paid for.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CheckoutItems', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      checkoutId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Checkouts', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      // Copies taken at checkout time (price in whole pesewas).
      productName: { type: Sequelize.STRING(150), allowNull: false },
      unitPrice: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      quantity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CheckoutItems');
  },
};
