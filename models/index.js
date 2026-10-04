/*
 * models/index.js
 *
 * Creates the single Sequelize connection for the app and loads every model
 * file in this folder. After loading, it calls each model's `associate()` so the
 * relationships (belongsTo, hasMany...) are set up.
 *
 * Anywhere in the app:  const { sequelize, User, Order } = require('../models');
 */
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const config = require('../config/database')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);
const db = {};

// Load every *.js file in this folder except this one.
fs.readdirSync(__dirname)
  .filter((file) => file.endsWith('.js') && file !== 'index.js')
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

// Relationships can only be set up once every model exists.
Object.values(db).forEach((model) => {
  if (model.associate) model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
