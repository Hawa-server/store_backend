/*
 * models/OrderStatusChange.js
 *
 * One entry in an order's status history (table: OrderStatusChanges).
 * History is never edited, so there is no updatedAt.
 */
const STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

module.exports = (sequelize, DataTypes) => {
  const OrderStatusChange = sequelize.define(
    'OrderStatusChange',
    {
      orderId: { type: DataTypes.INTEGER, allowNull: false },
      fromStatus: { type: DataTypes.ENUM(...STATUSES), allowNull: true },
      toStatus: { type: DataTypes.ENUM(...STATUSES), allowNull: false },
      changedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'OrderStatusChanges', updatedAt: false }
  );

  /*
   * associate(models)
   * Sets up OrderStatusChange's relationships. Receives: all models. Returns: nothing.
   */
  OrderStatusChange.associate = (models) => {
    OrderStatusChange.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderStatusChange.belongsTo(models.User, { foreignKey: 'changedByUserId', as: 'changedBy' });
  };

  return OrderStatusChange;
};
