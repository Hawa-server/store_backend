/*
 * models/DeliveryTown.js
 *
 * A town inside a delivery region (table: DeliveryTowns, BE24).
 * feePesewas is optional: NULL means the town uses its region's fee.
 */
module.exports = (sequelize, DataTypes) => {
  const DeliveryTown = sequelize.define(
    'DeliveryTown',
    {
      regionId: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(80), allowNull: false },
      feePesewas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'DeliveryTowns' }
  );

  /*
   * associate(models)
   * Sets up DeliveryTown's relationships. Receives: all models. Returns: nothing.
   */
  DeliveryTown.associate = (models) => {
    DeliveryTown.belongsTo(models.DeliveryRegion, { foreignKey: 'regionId', as: 'region' });
  };

  return DeliveryTown;
};
