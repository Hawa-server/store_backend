/*
 * models/DeliveryRegion.js
 *
 * One of Ghana's 16 regions, with its delivery fee (table: DeliveryRegions, BE24).
 * Regions come from the seeder; admins can change the fee and hide or show a
 * region, but not add, rename or delete one.
 */
module.exports = (sequelize, DataTypes) => {
  const DeliveryRegion = sequelize.define(
    'DeliveryRegion',
    {
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      feePesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'DeliveryRegions' }
  );

  /*
   * associate(models)
   * Sets up DeliveryRegion's relationships. Receives: all models. Returns: nothing.
   */
  DeliveryRegion.associate = (models) => {
    DeliveryRegion.hasMany(models.DeliveryTown, { foreignKey: 'regionId', as: 'towns' });
  };

  return DeliveryRegion;
};
