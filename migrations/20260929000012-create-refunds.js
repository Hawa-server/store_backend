/*
 * Migration: Refunds table.
 * Money returned to a shopper (cancellation, or an admin's full/partial refund).
 * The row is saved first (status 'requested'), then Paystack is called outside
 * the transaction, and the result is recorded as 'processed' or 'failed'.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Refunds', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      // Whole pesewas.
      amount: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      type: { type: Sequelize.ENUM('cancellation', 'full', 'partial'), allowNull: false },
      reason: { type: Sequelize.STRING(200), allowNull: false },
      status: {
        type: Sequelize.ENUM('requested', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'requested',
      },
      // Paystack's ID for the refund, once it has been created there.
      providerReference: { type: Sequelize.STRING(100), allowNull: true },
      failureReason: { type: Sequelize.STRING(255), allowNull: true },
      issuedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Refunds');
  },
};
