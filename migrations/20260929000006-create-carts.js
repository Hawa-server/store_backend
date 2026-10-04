/*
 * Migration: Carts table.
 * A cart belongs EITHER to a logged-in user (userId) OR to a guest
 * (guestToken, the random value stored in the guest's HTTP-only cookie).
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Carts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        // UNIQUE: each account has at most one cart, even if two requests try to
        // create one at the same moment. (MySQL allows many NULLs, so guest carts are fine.)
        unique: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      guestToken: { type: Sequelize.STRING(64), allowNull: true, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Carts');
  },
};
