/*
 * Migration: Orders table.
 * An order exists only after a payment is confirmed (BE9). Contact details and
 * money amounts are copied in at that moment, so the order never changes if the
 * user or products change later. All amounts are whole pesewas.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Orders', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      // Readable number shown to shoppers, e.g. ORD-20260929-7K2QXM.
      orderNumber: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      userId: {
        type: Sequelize.INTEGER,
        // NULL for guest orders.
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
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'GHS' },
      // A string rather than an ENUM so card payments can be added later without a migration.
      paymentMethod: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'mobile_money' },
      // UNIQUE: one Paystack payment can create at most one order (idempotency safety net).
      paymentReference: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      // Long random secret used in the confirmation page link (BE11).
      confirmationToken: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM('Pending', 'Shipped', 'Delivered', 'Cancelled'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Admin order list filters by status and date range.
    await queryInterface.addIndex('Orders', ['status']);
    await queryInterface.addIndex('Orders', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Orders');
  },
};
