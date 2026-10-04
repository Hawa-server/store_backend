/*
 * models/CartItem.js
 *
 * One product line in a cart (table: CartItems). No price here: prices are
 * always read from Products on the server.
 */
module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define(
    'CartItem',
    {
      cartId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { isInt: true, min: 1 } },
    },
    { tableName: 'CartItems' }
  );

  /*
   * associate(models)
   * Sets up CartItem's relationships. Receives: all models. Returns: nothing.
   */
  CartItem.associate = (models) => {
    CartItem.belongsTo(models.Cart, { foreignKey: 'cartId' });
    CartItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return CartItem;
};
