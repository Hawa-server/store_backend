/*
 * Migration: Reviews table.
 * One review per user per product (enforced by a UNIQUE constraint), with a
 * 1–5 rating (enforced by a CHECK constraint). Admins can hide a review (BE19);
 * hidden reviews stay in the table but are left out of public results.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Reviews', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      rating: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false },
      text: { type: Sequelize.STRING(1000), allowNull: true },
      editedAt: { type: Sequelize.DATE, allowNull: true },
      isHidden: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      hiddenReason: { type: Sequelize.STRING(200), allowNull: true },
      hiddenAt: { type: Sequelize.DATE, allowNull: true },
      hiddenByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('Reviews', {
      fields: ['userId', 'productId'],
      type: 'unique',
      name: 'reviews_user_product_unique',
    });

    // The database itself rejects ratings outside 1–5, even if a bug skips validation.
    await queryInterface.addConstraint('Reviews', {
      fields: ['rating'],
      type: 'check',
      where: { rating: { [Sequelize.Op.between]: [1, 5] } },
      name: 'reviews_rating_range',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Reviews');
  },
};
