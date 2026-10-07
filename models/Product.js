/*
 * models/Product.js
 *
 * A product for sale (table: Products). priceGhs is whole pesewas.
 * Stock can never go below 0 (the column is UNSIGNED and validated here too).
 */
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
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
