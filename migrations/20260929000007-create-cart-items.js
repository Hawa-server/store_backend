/*
 * Migration: CartItems table.
 * One line in a cart. No price is stored here: prices are always read from the
 * Products table on the server, so the client can never set its own price.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CartItems', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      cartId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Carts', key: 'id' },
        // Deleting a cart (e.g. the guest cart after merging) removes its lines.
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      quantity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // UNIQUE (cartId, productId): a product appears once per cart. Adding it
    // again increases the quantity of the existing line instead.
    await queryInterface.addConstraint('CartItems', {
      fields: ['cartId', 'productId'],
      type: 'unique',
      name: 'cart_items_cart_product_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CartItems');
  },
};
