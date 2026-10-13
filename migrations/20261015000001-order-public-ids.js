/*
 * Migration: a random public id for every order (BE26).
 *
 * Order pages used the database's counting number in the address
 * (/orders/9). That number can be guessed (try /orders/8) and reveals how many
 * orders the store has had. Each order now also gets a UUID, a long random
 * id like "3f2a9c1e-7b4d-4e8a-9f01-6c2d5e8b7a43", used in every address,
 * response and email link instead.
 *
 * The integer `id` STAYS as the primary key, used only inside the database
 * (foreign keys and joins such as OrderItems.orderId). So no other table,
 * foreign key or seed has to change: one new column, nothing else.
 *
 * Three steps, so orders that already exist get an id too:
 *   1. add publicId, allowing NULL for now;
 *   2. give every existing order its own UUID (Node's crypto.randomUUID, no
 *      extra library);
 *   3. make it NOT NULL and UNIQUE.
 */
'use strict';

const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Orders', 'publicId', { type: Sequelize.CHAR(36), allowNull: true, after: 'id' });

    const [orders] = await queryInterface.sequelize.query('SELECT id FROM Orders');
    for (const order of orders) {
      await queryInterface.sequelize.query('UPDATE Orders SET publicId = :publicId WHERE id = :id', {
        replacements: { publicId: crypto.randomUUID(), id: order.id },
      });
    }

    await queryInterface.changeColumn('Orders', 'publicId', { type: Sequelize.CHAR(36), allowNull: false });
    await queryInterface.addIndex('Orders', ['publicId'], { unique: true, name: 'orders_public_id_unique' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Orders', 'orders_public_id_unique');
    await queryInterface.removeColumn('Orders', 'publicId');
  },
};
