/*
 * Migration: sign out everywhere, password resets, and deleted accounts (BE27).
 *
 *   Users.sessionVersion  a counter copied into every login token (as "sv").
 *                         Adding 1 makes every existing token for that user
 *                         stop working: "sign out on every device". Used by
 *                         password resets and account deletion.
 *   Users.deletedAt       when the shopper deleted their account. The row is
 *                         kept as an empty shell (orders still point at it).
 *   EmailTokens.type      gains 'passwordReset' (the "forgot password" links,
 *                         stored hashed and one-use, like verification links).
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'sessionVersion', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      after: 'emailVerifiedAt',
    });
    await queryInterface.addColumn('Users', 'deletedAt', { type: Sequelize.DATE, allowNull: true, after: 'sessionVersion' });
    await queryInterface.changeColumn('EmailTokens', 'type', {
      type: Sequelize.ENUM('verify', 'loginCode', 'passwordReset'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // The old type list has no 'passwordReset', so those rows must go first:
    // MySQL can't shrink an ENUM while rows still use the removed value.
    await queryInterface.sequelize.query("DELETE FROM EmailTokens WHERE type = 'passwordReset'");
    await queryInterface.changeColumn('EmailTokens', 'type', { type: Sequelize.ENUM('verify', 'loginCode'), allowNull: false });
    await queryInterface.removeColumn('Users', 'deletedAt');
    await queryInterface.removeColumn('Users', 'sessionVersion');
  },
};
