/*
 * Migration: PaymentEvents table.
 * A log of every Paystack webhook we receive (BE8): useful for troubleshooting
 * and for spotting duplicates. Never stores card or wallet details.
 * `receivedAt` plays the role of createdAt, so there are no timestamp columns.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PaymentEvents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      provider: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'paystack' },
      eventType: { type: Sequelize.STRING(50), allowNull: false },
      reference: { type: Sequelize.STRING(100), allowNull: true },
      receivedAt: { type: Sequelize.DATE, allowNull: false },
      processedAt: { type: Sequelize.DATE, allowNull: true },
      outcome: { type: Sequelize.STRING(100), allowNull: true },
    });

    await queryInterface.addIndex('PaymentEvents', ['reference']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PaymentEvents');
  },
};
