/*
 * Migration: Checkouts table.
 * Holds a checkout between "start payment" (BE7) and "payment confirmed" (BE9).
 * The totals are calculated by the server when the checkout starts, and later
 * compared with what Paystack says was actually paid.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Checkouts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      // Our unique payment reference, sent to Paystack.
      reference: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      cartId: {
        type: Sequelize.INTEGER,
        // Nullable + SET NULL: when a guest cart is deleted after merging (BE6),
        // old checkouts just lose the link instead of blocking the delete.
        allowNull: true,
        references: { model: 'Carts', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      email: { type: Sequelize.STRING(255), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      address: { type: Sequelize.STRING(500), allowNull: false },
      subtotal: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      deliveryFee: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      total: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      status: { type: Sequelize.ENUM('open', 'paid', 'failed'), allowNull: false, defaultValue: 'open' },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        // UNIQUE: a checkout leads to at most one order, and an order to one checkout.
        unique: true,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Checkouts');
  },
};
