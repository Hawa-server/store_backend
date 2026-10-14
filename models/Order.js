/*
 * models/Order.js
 *
 * A paid order (table: Orders). Contact details and amounts (pesewas) are
 * copied in when the order is created, so they never change afterwards.
 *
 * Two ids (BE26):
 *   id        the counting number (1, 2, 3...), used ONLY inside the database
 *             (foreign keys, joins). Never sent to anyone.
 *   publicId  a random UUID, used in every address, response and email link,
 *             so order ids can't be guessed and don't reveal the order count.
 */
const crypto = require('crypto');

const ORDER_STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    'Order',
    {
      // Set automatically for every new order, so no code that creates an
      // order has to remember it.
      publicId: { type: DataTypes.CHAR(36), allowNull: false, unique: true, defaultValue: () => crypto.randomUUID() },
      orderNumber: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      // When a guest order was linked to an account (BE25); null otherwise.
      linkedAt: { type: DataTypes.DATE, allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      // Where it's delivered (BE24). Names are copies, kept even if the area
      // is later renamed or hidden. All null on orders from before BE24;
      // deliveryTownId/Name are null for "Other town in this region".
      deliveryRegionId: { type: DataTypes.INTEGER, allowNull: true },
      deliveryTownId: { type: DataTypes.INTEGER, allowNull: true },
      deliveryRegionName: { type: DataTypes.STRING(80), allowNull: true },
      deliveryTownName: { type: DataTypes.STRING(80), allowNull: true },
      subtotal: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      // Discount (BE29): the code used (a copy of its text, kept even if the
      // code changes later) and the discount given, in pesewas (0 = none).
      discountCodeId: { type: DataTypes.INTEGER, allowNull: true },
      discountCode: { type: DataTypes.STRING(20), allowNull: true },
      discountPesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
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
    Order.belongsTo(models.DeliveryRegion, { foreignKey: 'deliveryRegionId', as: 'deliveryRegion' });
    Order.belongsTo(models.DeliveryTown, { foreignKey: 'deliveryTownId', as: 'deliveryTown' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
    Order.hasMany(models.OrderStatusChange, { foreignKey: 'orderId', as: 'statusHistory' });
    Order.hasMany(models.Refund, { foreignKey: 'orderId', as: 'refunds' });
    Order.hasOne(models.Checkout, { foreignKey: 'orderId' });
    Order.hasOne(models.DiscountRedemption, { foreignKey: 'orderId', as: 'discountRedemption' });
  };

  return Order;
};
