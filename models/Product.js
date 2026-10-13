/*
 * models/Product.js
 *
 * A product for sale (table: Products). priceGhs is whole pesewas.
 * Stock can never go below 0 (the column is UNSIGNED and validated here too).
 *
 * Two ids (like orders, BE26): `id` (1, 2, 3...) is used ONLY inside the
 * database (cart, checkout, order and review rows point at it); `publicId`, a
 * random UUID, is what every address and response shows as the product's id.
 */
const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      // Set automatically for every new product (e.g. one added by an admin).
      publicId: { type: DataTypes.CHAR(36), allowNull: false, unique: true, defaultValue: () => crypto.randomUUID() },
      categoryId: { type: DataTypes.INTEGER, allowNull: false },
      // Unique (BE23 migration): the catalogue, the seeders and admins identify products by name.
      name: { type: DataTypes.STRING(150), allowNull: false, unique: 'products_name_unique' },
      description: { type: DataTypes.TEXT, allowNull: false },
      priceGhs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { isInt: true, min: 0 } },
      stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, validate: { isInt: true, min: 0 } },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'Products' }
  );

  /*
   * associate(models)
   * Sets up Product's relationships. Receives: all models. Returns: nothing.
   */
  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: 'categoryId' });
    Product.hasMany(models.ProductImage, { foreignKey: 'productId', as: 'images' });
    Product.hasMany(models.Review, { foreignKey: 'productId' });
    Product.hasMany(models.CartItem, { foreignKey: 'productId' });
    Product.hasMany(models.OrderItem, { foreignKey: 'productId' });
  };

  return Product;
};
