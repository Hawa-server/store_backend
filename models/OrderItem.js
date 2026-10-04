/*
 * models/OrderItem.js
 *
 * One product in an order (table: OrderItems), with the name and unit price
 * (pesewas) copied at the time of purchase.
 */
module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      orderId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      productName: { type: DataTypes.STRING(150), allowNull: false },
      unitPrice: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { isInt: true, min: 1 } },
    },
    { tableName: 'OrderItems' }
  );

  /*
   * associate(models)
   * Sets up OrderItem's relationships. Receives: all models. Returns: nothing.
   */
  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return OrderItem;
};
