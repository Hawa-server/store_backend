/*
 * models/WishlistItem.js
 *
 * One product a shopper saved for later (table: WishlistItems, BE28).
 * Only the link is stored (who, which product, when): the price and stock
 * are always read from the product, so the wishlist is never out of date.
 */
module.exports = (sequelize, DataTypes) => {
  const WishlistItem = sequelize.define(
    'WishlistItem',
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
    },
    { tableName: 'WishlistItems', updatedAt: false }
  );

  /*
   * associate(models)
   * Sets up WishlistItem's relationships. Receives: all models. Returns: nothing.
   */
  WishlistItem.associate = (models) => {
    WishlistItem.belongsTo(models.User, { foreignKey: 'userId' });
    WishlistItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return WishlistItem;
};
