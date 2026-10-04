/*
 * models/Order.js
 *
 * A paid order (table: Orders). Contact details and amounts (pesewas) are
 * copied in when the order is created, so they never change afterwards.
 */
const ORDER_STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    'Order',
    {
      orderNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      subtotal: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      deliveryFee: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      total: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'GHS' },
      paymentMethod: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'mobile_money',
        validate: { isIn: [['mobile_money']] },
      },
      paymentReference: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      confirmationToken: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      status: { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: false, defaultValue: 'Pending' },
    },
    { tableName: 'Orders' }
  );

  Order.STATUSES = ORDER_STATUSES;

  /*
   * associate(models)
   * Sets up Order's relationships. Receives: all models. Returns: nothing.
   */
  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'userId' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
    Order.hasMany(models.OrderStatusChange, { foreignKey: 'orderId', as: 'statusHistory' });
    Order.hasMany(models.Refund, { foreignKey: 'orderId', as: 'refunds' });
    Order.hasOne(models.Checkout, { foreignKey: 'orderId' });
  };

  return Order;
};
