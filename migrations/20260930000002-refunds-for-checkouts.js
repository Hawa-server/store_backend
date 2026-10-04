/*
 * Migration: let a refund belong to a CHECKOUT instead of an order (BE9).
 *
 * Normally a refund belongs to an order (cancellations, admin refunds). But if
 * a shopper pays and the item sells out before their payment is confirmed, no
 * order is ever created, yet their money must still go back. That refund
 * belongs to the paid checkout.
 *
 * Changes:
 *   - Refunds.orderId becomes nullable.
 *   - New nullable Refunds.checkoutId → Checkouts.id.
 *   - CHECK: exactly one of orderId / checkoutId is set on every refund.
 *
 * MySQL detail: a CHECK constraint may not use a column whose foreign key has
 * a referential action like ON UPDATE CASCADE. So both foreign keys use
 * RESTRICT (ids never change, and orders/checkouts are never deleted).
 */
'use strict';

/*
 * findForeignKeyName(queryInterface, column)
 * Receives: the migration's queryInterface and a Refunds column name.
 * Returns: the name MySQL gave that column's foreign key constraint.
 */
async function findForeignKeyName(queryInterface, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Refunds'
       AND COLUMN_NAME = :column AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: { column } }
  );
  return rows[0].name;
}

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    const orderFk = await findForeignKeyName(queryInterface, 'orderId');

    await q(`ALTER TABLE Refunds DROP FOREIGN KEY \`${orderFk}\``);
    await q('ALTER TABLE Refunds MODIFY orderId INT NULL');
    await q(`ALTER TABLE Refunds ADD CONSTRAINT refunds_order_fk FOREIGN KEY (orderId)
             REFERENCES Orders (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);

    await q('ALTER TABLE Refunds ADD COLUMN checkoutId INT NULL AFTER orderId');
    await q(`ALTER TABLE Refunds ADD CONSTRAINT refunds_checkout_fk FOREIGN KEY (checkoutId)
             REFERENCES Checkouts (id) ON DELETE RESTRICT ON UPDATE RESTRICT`);

    // Exactly one owner: (orderId is set) XOR (checkoutId is set).
    await q(`ALTER TABLE Refunds ADD CONSTRAINT refunds_one_owner
             CHECK ((orderId IS NULL) <> (checkoutId IS NULL))`);
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    // Refunds for checkouts ("paid but sold out", BE9) have no order. The old
    // table shape requires an order, so they can't be kept when undoing. Remove
    // them FIRST: MySQL can't roll back table changes, so a failure halfway
    // through would leave the table half-changed.
    await q('DELETE FROM Refunds WHERE orderId IS NULL');
    await q('ALTER TABLE Refunds DROP CHECK refunds_one_owner');
    await q('ALTER TABLE Refunds DROP FOREIGN KEY refunds_checkout_fk');
    await q('ALTER TABLE Refunds DROP COLUMN checkoutId');
    await q('ALTER TABLE Refunds DROP FOREIGN KEY refunds_order_fk');
    await q('ALTER TABLE Refunds MODIFY orderId INT NOT NULL');
    await q(`ALTER TABLE Refunds ADD CONSTRAINT refunds_order_fk FOREIGN KEY (orderId)
             REFERENCES Orders (id) ON DELETE RESTRICT ON UPDATE CASCADE`);
  },
};
