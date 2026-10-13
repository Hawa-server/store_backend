/*
 * models/Checkout.js
 *
 * A checkout between "start payment" and "payment confirmed" (table: Checkouts).
 * Totals are calculated by the server; no order exists until payment succeeds.
 */
module.exports = (sequelize, DataTypes) => {
  const Checkout = sequelize.define(
    'Checkout',
    {
      reference: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      cartId: { type: DataTypes.INTEGER, allowNull: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
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
      deliveryFee: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      total: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      status: { type: DataTypes.ENUM('open', 'paid', 'failed'), allowNull: false, defaultValue: 'open' },
      orderId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    },
    { tableName: 'Checkouts' }
  );

  /*
   * associate(models)
   * Sets up Checkout's relationships. Receives: all models. Returns: nothing.
   */
  Checkout.associate = (models) => {
    Checkout.belongsTo(models.Cart, { foreignKey: 'cartId' });
    Checkout.belongsTo(models.User, { foreignKey: 'userId' });
    Checkout.belongsTo(models.DeliveryRegion, { foreignKey: 'deliveryRegionId', as: 'deliveryRegion' });
    Checkout.belongsTo(models.DeliveryTown, { foreignKey: 'deliveryTownId', as: 'deliveryTown' });
    Checkout.belongsTo(models.Order, { foreignKey: 'orderId' });
    Checkout.hasMany(models.CheckoutItem, { foreignKey: 'checkoutId', as: 'items' });
    Checkout.hasMany(models.Refund, { foreignKey: 'checkoutId', as: 'refunds' });
  };

  return Checkout;
};
