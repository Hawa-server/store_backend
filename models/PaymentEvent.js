/*
 * models/PaymentEvent.js
 *
 * A record of one Paystack webhook (table: PaymentEvents), for troubleshooting
 * and duplicate detection. Uses receivedAt instead of createdAt/updatedAt.
 */
module.exports = (sequelize, DataTypes) => {
  const PaymentEvent = sequelize.define(
    'PaymentEvent',
    {
      provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'paystack' },
      eventType: { type: DataTypes.STRING(50), allowNull: false },
      reference: { type: DataTypes.STRING(100), allowNull: true },
      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processedAt: { type: DataTypes.DATE, allowNull: true },
      outcome: { type: DataTypes.STRING(100), allowNull: true },
    },
    { tableName: 'PaymentEvents', timestamps: false }
  );

  return PaymentEvent;
};
