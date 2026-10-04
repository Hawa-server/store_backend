/*
 * models/CheckoutItem.js
 *
 * One line of a checkout (table: CheckoutItems): the product, its name and
 * unit price (pesewas) at checkout time, and the quantity. Orders are built
 * from these rows after payment, so they match exactly what was paid for.
 */
module.exports = (sequelize, DataTypes) => {
  const CheckoutItem = sequelize.define(
    'CheckoutItem',
    {
      checkoutId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      productName: { type: DataTypes.STRING(150), allowNull: false },
      unitPrice: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { isInt: true, min: 1 } },
    },
    { tableName: 'CheckoutItems' }
  );

  /*
   * associate(models)
   * Sets up CheckoutItem's relationships. Receives: all models. Returns: nothing.
   */
  CheckoutItem.associate = (models) => {
    CheckoutItem.belongsTo(models.Checkout, { foreignKey: 'checkoutId' });
    CheckoutItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return CheckoutItem;
};
