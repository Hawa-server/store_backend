/*
 * models/ProductImage.js
 *
 * One ImageKit photo of a product (table: ProductImages).
 */
module.exports = (sequelize, DataTypes) => {
  const ProductImage = sequelize.define(
    'ProductImage',
    {
      productId: { type: DataTypes.INTEGER, allowNull: false },
      url: { type: DataTypes.STRING(500), allowNull: false },
      fileId: { type: DataTypes.STRING(100), allowNull: true },
      altText: { type: DataTypes.STRING(200), allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isMain: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'ProductImages' }
  );

  /*
   * associate(models)
   * Sets up ProductImage's relationships. Receives: all models. Returns: nothing.
   */
  ProductImage.associate = (models) => {
    ProductImage.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return ProductImage;
};
