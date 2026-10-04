/*
 * Migration: OrderStatusChanges table.
 * The order's history: one row per status change (e.g. Pending → Shipped),
 * with who made it. Rows are never edited, so there's no updatedAt.
 */
'use strict';

const STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OrderStatusChanges', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      // NULL for the first entry (the order was just created).
      fromStatus: { type: Sequelize.ENUM(...STATUSES), allowNull: true },
      toStatus: { type: Sequelize.ENUM(...STATUSES), allowNull: false },
      changedByUserId: {
        type: Sequelize.INTEGER,
        // NULL when the system made the change (e.g. order created after payment).
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OrderStatusChanges');
  },
};
