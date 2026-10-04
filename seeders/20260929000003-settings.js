/*
 * Seeder: starting values for the store settings.
 *   usdRate           15.50 GHS per 1 USD (display only; GHS is what's charged)
 *   deliveryFee       2000 pesewas = GHS 20.00 flat fee
 *   lowStockThreshold 5 (admin dashboard, BE20)
 */
'use strict';

const SETTINGS = [
  { key: 'usdRate', value: '15.50' },
  { key: 'deliveryFee', value: '2000' },
  { key: 'lowStockThreshold', value: '5' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'Settings',
      SETTINGS.map((s) => ({ ...s, createdAt: now, updatedAt: now }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Settings', { key: SETTINGS.map((s) => s.key) });
  },
};
