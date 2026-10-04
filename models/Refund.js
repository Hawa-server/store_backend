/*
 * models/Refund.js
 *
 * Money returned to a shopper (table: Refunds). amount is whole pesewas.
 * A refund belongs to EITHER an order (cancellation, admin refund) OR a paid
 * checkout that never became an order (item sold out after payment, BE9).
 * A database CHECK makes sure exactly one of orderId / checkoutId is set.
 * Created as 'requested', then updated to 'processed' or 'failed' after
 * Paystack answers (outside the database transaction).
 */
module.exports = (sequelize, DataTypes) => {
  const Refund = sequelize.define(
    'Refund',
    {
      orderId: { type: DataTypes.INTEGER, allowNull: true },
      checkoutId: { type: DataTypes.INTEGER, allowNull: true },
      amount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { isInt: true, min: 1 } },
      type: { type: DataTypes.ENUM('cancellation', 'full', 'partial'), allowNull: false },
      reason: { type: DataTypes.STRING(200), allowNull: false },
      status: {
        type: DataTypes.ENUM('requested', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'requested',
      },
      providerReference: { type: DataTypes.STRING(100), allowNull: true },
      failureReason: { type: DataTypes.STRING(255), allowNull: true },
      issuedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: 'Refunds' }
  );

  /*
   * associate(models)
   * Sets up Refund's relationships. Receives: all models. Returns: nothing.
   */
  Refund.associate = (models) => {
    Refund.belongsTo(models.Order, { foreignKey: 'orderId' });
    Refund.belongsTo(models.Checkout, { foreignKey: 'checkoutId' });
    Refund.belongsTo(models.User, { foreignKey: 'issuedByUserId', as: 'issuedBy' });
  };

  return Refund;
};
