/*
 * Seeder: the six store categories, in display order.
 * Other seeders find these by slug (never by an assumed id).
 */
'use strict';

const CATEGORIES = [
  { name: 'Bags', slug: 'bags', sortOrder: 1 },
  { name: 'Makeup', slug: 'makeup', sortOrder: 2 },
  { name: 'Skincare', slug: 'skincare', sortOrder: 3 },
  { name: 'Jewellery', slug: 'jewellery', sortOrder: 4 },
  { name: 'Accessories', slug: 'accessories', sortOrder: 5 },
  { name: 'Perfumes', slug: 'perfumes', sortOrder: 6 },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'Categories',
      CATEGORIES.map((c) => ({ ...c, createdAt: now, updatedAt: now }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Categories', { slug: CATEGORIES.map((c) => c.slug) });
  },
};
