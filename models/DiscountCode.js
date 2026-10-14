/*
 * models/DiscountCode.js
 *
 * A discount code the admin created, e.g. ADORN10 (table: DiscountCodes, BE29).
 * Money is whole pesewas. timesUsed counts PAID orders that used the code.
 */
module.exports = (sequelize, DataTypes) => {
  const DiscountCode = sequelize.define(
    'DiscountCode',
    {
      code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      type: { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false },
      value: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      maxDiscountPesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      minSubtotalPesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      startsAt: { type: DataTypes.DATE, allowNull: true },
      endsAt: { type: DataTypes.DATE, allowNull: true },
      usageLimit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      oncePerCustomer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      timesUsed: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'DiscountCodes' }
  );

  /*
   * associate(models)
   * Sets up DiscountCode's relationships. Receives: all models. Returns: nothing.
   */
  DiscountCode.associate = (models) => {
    DiscountCode.hasMany(models.DiscountRedemption, { foreignKey: 'discountCodeId', as: 'redemptions' });
    DiscountCode.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
  };

  return DiscountCode;
};
