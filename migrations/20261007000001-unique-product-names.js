/*
 * Migration: product names must be unique (BE23).
 *
 * Admins can now add and rename products, and the seeders and
 * docs/catalogue.md find products by name, so two products must never share
 * one. The service checks this first (for a friendly 409), but two admins
 * saving the same name at the same instant could both pass that check. This
 * UNIQUE index is the backstop: the database itself refuses the second one.
 *
 * The column's collation (utf8mb4_0900_ai_ci) ignores case and accents, so
 * "Pink Lip Gloss" and "pink lip gloss" count as the same name.
 */
'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('Products', ['name'], { unique: true, name: 'products_name_unique' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Products', 'products_name_unique');
  },
};
