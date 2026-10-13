/*
 * Migration: a random public id for every product.
 *
 * The same idea as the order UUIDs (BE26, 20261015000001-order-public-ids.js).
 * Product addresses used the counting number (/api/products/12), which shows
 * how many products the store has and in what order they were added. Each
 * product now also gets a UUID, used in every address and response instead.
 *
 * The integer `id` STAYS the primary key, used only inside the database:
 * CartItems, CheckoutItems, OrderItems, Reviews and ProductImages keep
 * pointing at it, so no other table changes.
 *
 * Three steps, so existing products get an id too: add publicId (NULL
 * allowed), give every product its own crypto.randomUUID(), then make it
 * NOT NULL and UNIQUE.
 */
'use strict';

const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'publicId', { type: Sequelize.CHAR(36), allowNull: true, after: 'id' });

    const [products] = await queryInterface.sequelize.query('SELECT id FROM Products');
    for (const product of products) {
      await queryInterface.sequelize.query('UPDATE Products SET publicId = :publicId WHERE id = :id', {
        replacements: { publicId: crypto.randomUUID(), id: product.id },
      });
    }

    await queryInterface.changeColumn('Products', 'publicId', { type: Sequelize.CHAR(36), allowNull: false });
    await queryInterface.addIndex('Products', ['publicId'], { unique: true, name: 'products_public_id_unique' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Products', 'products_public_id_unique');
    await queryInterface.removeColumn('Products', 'publicId');
  },
};
