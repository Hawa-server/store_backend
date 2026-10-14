/*
 * models/DiscountRedemption.js
 *
 * One PAID order that used a discount code (table: DiscountRedemptions, BE29).
 * Created by fulfilment, in the same transaction as the order. The email is
 * lower-cased and trimmed (like checkout and order emails), and is what
 * "once per customer" checks, so it works for guests as well as accounts.
 */
module.exports = (sequelize, DataTypes) => {
  const DiscountRedemption = sequelize.define(
    'DiscountRedemption',
    {
      discountCodeId: { type: DataTypes.INTEGER, allowNull: false },
      orderId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      email: { type: DataTypes.STRING(255), allowNull: false },
      discountPesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    },
    { tableName: 'DiscountRedemptions', updatedAt: false }
  );

  /*
   * associate(models)
   * Sets up DiscountRedemption's relationships. Receives: all models. Returns: nothing.
   */
  DiscountRedemption.associate = (models) => {
    DiscountRedemption.belongsTo(models.DiscountCode, { foreignKey: 'discountCodeId' });
    DiscountRedemption.belongsTo(models.Order, { foreignKey: 'orderId' });
  };

  return DiscountRedemption;
};
