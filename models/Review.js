/*
 * models/Review.js
 *
 * A shopper's rating (1–5) and optional text for a product (table: Reviews).
 * One per user per product. Hidden reviews stay stored but are left out of
 * public lists and averages.
 */
module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define(
    'Review',
    {
      productId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { isInt: true, min: 1, max: 5 } },
      text: { type: DataTypes.STRING(1000), allowNull: true },
      editedAt: { type: DataTypes.DATE, allowNull: true },
      isHidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      hiddenReason: { type: DataTypes.STRING(200), allowNull: true },
      hiddenAt: { type: DataTypes.DATE, allowNull: true },
      hiddenByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'Reviews',
      indexes: [{ unique: true, fields: ['userId', 'productId'] }],
    }
  );

  /*
   * associate(models)
   * Sets up Review's relationships. Receives: all models. Returns: nothing.
   */
  Review.associate = (models) => {
    Review.belongsTo(models.Product, { foreignKey: 'productId' });
    Review.belongsTo(models.User, { foreignKey: 'userId', as: 'reviewer' });
    Review.belongsTo(models.User, { foreignKey: 'hiddenByUserId', as: 'hiddenBy' });
  };

  return Review;
};
