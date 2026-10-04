/*
 * Migration: EmailTokens table.
 * One-time secrets sent by email: verification links (type 'verify') and
 * login codes (type 'loginCode', BE12). Only a SHA-256 hash of the secret is
 * stored, so a database leak doesn't hand out working links or codes.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('EmailTokens', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        // Tokens belong to the user; if the user is removed, their tokens go too.
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: { type: Sequelize.ENUM('verify', 'loginCode'), allowNull: false },
      tokenHash: { type: Sequelize.STRING(64), allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      // Wrong-code attempts (login codes allow at most 5).
      attempts: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      usedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Verification looks tokens up by their hash.
    await queryInterface.addIndex('EmailTokens', ['tokenHash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('EmailTokens');
  },
};
