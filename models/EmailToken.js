/*
 * models/EmailToken.js
 *
 * A one-time verification link or login code sent by email (table: EmailTokens).
 * Only the SHA-256 hash is stored. There is no updatedAt column.
 */
module.exports = (sequelize, DataTypes) => {
  const EmailToken = sequelize.define(
    'EmailToken',
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.ENUM('verify', 'loginCode'), allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      usedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'EmailTokens', updatedAt: false }
  );

  /*
   * associate(models)
   * Sets up EmailToken's relationships. Receives: all models. Returns: nothing.
   */
  EmailToken.associate = (models) => {
    EmailToken.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return EmailToken;
};
