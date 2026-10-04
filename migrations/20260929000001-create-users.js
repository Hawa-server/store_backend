/*
 * Migration: Users table.
 * Shoppers and admins. The password is only ever stored as a bcrypt hash.
 * A user can't log in until emailVerifiedAt is set (BE2).
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      // UNIQUE: one account per email address.
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING(255), allowNull: false },
      isAdmin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      emailVerifiedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Users');
  },
};
