/*
 * models/Setting.js
 *
 * One key/value setting (table: Settings): usdRate, deliveryFee, lowStockThreshold.
 * Other code must read/write these only through the settings service (BE7/BE13/BE20),
 * which converts the stored text to the right type.
 */
module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define(
    'Setting',
    {
      key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      value: { type: DataTypes.STRING(255), allowNull: false },
    },
    { tableName: 'Settings' }
  );

  return Setting;
};
