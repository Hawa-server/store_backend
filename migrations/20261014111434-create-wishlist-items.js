/*
 * Migration: WishlistItems (BE28).
 *
 * A "save for later" list for logged-in shoppers. Each row says "this user
 * saved this product". It's a JOIN TABLE: one user saves many products, and
 * one product can be saved by many users (a many-to-many relationship).
 *
 *   userId     → Users.id     CASCADE: the rows go if a user row is ever
 *                             really deleted. (Account deletion in BE27 keeps
 *                             the user row, so it deletes these rows itself.)
 *   productId  → Products.id  RESTRICT, like orders: products are deactivated,
 *                             never deleted.
 *   UNIQUE (userId, productId): a product is saved at most once per shopper.
 *
 * Only createdAt (when it was saved): a saved item never changes.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('WishlistItems', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('WishlistItems', ['userId', 'productId'], {
      unique: true,
      name: 'wishlist_items_user_product_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WishlistItems');
  },
};
