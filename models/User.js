/*
 * models/User.js
 *
 * A shopper or admin account (table: Users).
 * Security: the default scope leaves out `passwordHash`, so ordinary queries
 * can never accidentally send the hash to the client. Code that needs to check
 * a password must ask for it explicitly: User.scope('withPassword').
 */
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      // BE27: copied into every login token as "sv". Adding 1 signs the user
      // out on every device (password reset, account deletion).
      sessionVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      // BE27: set when the shopper deleted their account (the row stays as an
      // empty shell, because past orders point at it).
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'Users',
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
      scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
    }
  );

  /*
   * associate(models)
   * Sets up User's relationships. Receives: all models. Returns: nothing.
   */
  User.associate = (models) => {
    User.hasMany(models.EmailToken, { foreignKey: 'userId' });
    User.hasOne(models.Cart, { foreignKey: 'userId' });
    User.hasMany(models.Order, { foreignKey: 'userId' });
    User.hasMany(models.Review, { foreignKey: 'userId' });
    User.hasMany(models.WishlistItem, { foreignKey: 'userId' });
  };

  return User;
};
