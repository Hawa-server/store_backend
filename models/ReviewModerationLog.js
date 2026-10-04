/*
 * models/ReviewModerationLog.js
 *
 * One admin action on a review (table: ReviewModerationLogs, BE19): hide,
 * unhide or delete, with who did it, why, when, and a copy of the review
 * ({ rating, text, createdAt }) as it was at that moment. Rows are only ever
 * added, never edited, so there is no updatedAt.
 */
module.exports = (sequelize, DataTypes) => {
  const ReviewModerationLog = sequelize.define(
    'ReviewModerationLog',
    {
      reviewId: { type: DataTypes.INTEGER, allowNull: true },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      reviewerUserId: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.ENUM('hide', 'unhide', 'delete'), allowNull: false },
      reason: { type: DataTypes.STRING(200), allowNull: true },
      adminUserId: { type: DataTypes.INTEGER, allowNull: true },
      reviewCopy: { type: DataTypes.JSON, allowNull: false },
    },
    { tableName: 'ReviewModerationLogs', updatedAt: false }
  );

  /*
   * associate(models)
   * Sets up ReviewModerationLog's relationships. Receives: all models. Returns: nothing.
   */
  ReviewModerationLog.associate = (models) => {
    ReviewModerationLog.belongsTo(models.Product, { foreignKey: 'productId' });
    ReviewModerationLog.belongsTo(models.User, { foreignKey: 'reviewerUserId', as: 'reviewer' });
    ReviewModerationLog.belongsTo(models.User, { foreignKey: 'adminUserId', as: 'admin' });
  };

  return ReviewModerationLog;
};
