/*
 * Migration: discount codes (BE29).
 *
 *   DiscountCodes        the codes the admin creates (e.g. ADORN10). Money is
 *                        whole pesewas. timesUsed counts PAID orders only.
 *   DiscountRedemptions  one row per paid order that used a code: which code,
 *                        which order (UNIQUE: an order is counted once), the
 *                        email (lower-cased, for "once per customer") and the
 *                        discount given.
 *   Checkouts, Orders    gain discountCodeId, discountCode (a COPY of the text,
 *                        kept even if the code changes later) and
 *                        discountPesewas (0 for old rows and orders without a code).
 *
 * Relationships: a DiscountCode has many DiscountRedemptions; each redemption
 * belongs to one Order. Foreign keys are RESTRICT: codes and orders are never
 * deleted (codes are switched off instead).
 */
'use strict';

const DISCOUNT_COLUMNS = ['Checkouts', 'Orders'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DiscountCodes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      // Stored upper-case; the column also ignores case, so "adorn10" = "ADORN10".
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM('percent', 'fixed'), allowNull: false },
      // percent: 1–90 (whole percent); fixed: pesewas.
      value: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      maxDiscountPesewas: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      minSubtotalPesewas: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      startsAt: { type: Sequelize.DATE, allowNull: true },
      endsAt: { type: Sequelize.DATE, allowNull: true },
      usageLimit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      oncePerCustomer: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      timesUsed: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('DiscountRedemptions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      discountCodeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'DiscountCodes', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      },
      email: { type: Sequelize.STRING(255), allowNull: false },
      discountPesewas: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    // "Has this email already used this code?" is asked at every checkout.
    await queryInterface.addIndex('DiscountRedemptions', ['discountCodeId', 'email'], { name: 'discount_redemptions_code_email' });

    const q = (sql) => queryInterface.sequelize.query(sql);
    for (const table of DISCOUNT_COLUMNS) {
      const prefix = table.toLowerCase();
      await q(`ALTER TABLE ${table}
               ADD COLUMN discountCodeId INT NULL AFTER subtotal,
               ADD COLUMN discountCode VARCHAR(20) NULL AFTER discountCodeId,
               ADD COLUMN discountPesewas INT UNSIGNED NOT NULL DEFAULT 0 AFTER discountCode`);
      await q(`ALTER TABLE ${table}
               ADD CONSTRAINT ${prefix}_discount_code_fk FOREIGN KEY (discountCodeId)
                 REFERENCES DiscountCodes (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);
    }
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    for (const table of DISCOUNT_COLUMNS) {
      const prefix = table.toLowerCase();
      await q(`ALTER TABLE ${table} DROP FOREIGN KEY ${prefix}_discount_code_fk`);
      await q(`ALTER TABLE ${table} DROP COLUMN discountCodeId, DROP COLUMN discountCode, DROP COLUMN discountPesewas`);
    }
    await queryInterface.dropTable('DiscountRedemptions');
    await queryInterface.dropTable('DiscountCodes');
  },
};
