/*
 * models/Category.js
 *
 * A product category such as Bags or Makeup (table: Categories).
 */
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      name: { type: DataTypes.STRING(50), allowNull: false },
      slug: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'Categories' }
  );

  /*
   * associate(models)
   * Sets up Category's relationships. Receives: all models. Returns: nothing.
   */
  Category.associate = (models) => {
    Category.hasMany(models.Product, { foreignKey: 'categoryId' });
  };

  return Category;
};
