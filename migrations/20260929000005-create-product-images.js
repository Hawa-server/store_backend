/*
 * Migration: ProductImages table.
 * Each row is one ImageKit photo of a product. `fileId` is ImageKit's ID for
 * images uploaded through the API (BE21 stretch); it's empty for seeded images.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProductImages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      url: { type: Sequelize.STRING(500), allowNull: false },
      fileId: { type: Sequelize.STRING(100), allowNull: true },
      altText: { type: Sequelize.STRING(200), allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isMain: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ProductImages');
  },
};
