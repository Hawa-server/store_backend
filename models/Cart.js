/*
 * models/Cart.js
 *
 * A shopping cart owned by a logged-in user (userId) or a guest (guestToken
 * from the HTTP-only cookie) (table: Carts).
 */
module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define(
    'Cart',
    {
      userId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
      guestToken: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    },
    { tableName: 'Carts' }
  );

  /*
   * associate(models)
   * Sets up Cart's relationships. Receives: all models. Returns: nothing.
   */
  Cart.associate = (models) => {
    Cart.belongsTo(models.User, { foreignKey: 'userId' });
    Cart.hasMany(models.CartItem, { foreignKey: 'cartId', as: 'items' });
  };

  return Cart;
};
