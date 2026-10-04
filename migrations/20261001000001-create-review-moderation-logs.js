/*
 * Migration: ReviewModerationLogs table (BE19).
 * A permanent record of every admin action on a review: hide, unhide, delete.
 * Each row keeps a COPY of the review's rating and text, because after a
 * delete the review itself is gone.
 *
 * reviewId is a plain number, NOT a foreign key: with a foreign key, deleting
 * the review would have to blank or delete these rows, and the history of
 * that review would be lost. The log is append-only: rows are never changed.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ReviewModerationLogs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      reviewId: { type: Sequelize.INTEGER, allowNull: true },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'RESTRICT', // products are deactivated, never deleted; keep the history
        onUpdate: 'CASCADE',
      },
      reviewerUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      action: { type: Sequelize.ENUM('hide', 'unhide', 'delete'), allowNull: false },
      reason: { type: Sequelize.STRING(200), allowNull: true },
      adminUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      reviewCopy: { type: Sequelize.JSON, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ReviewModerationLogs', ['reviewId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ReviewModerationLogs');
  },
};
