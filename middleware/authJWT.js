const jwt = require('jsonwebtoken');
const db = require('../models/db');
require('dotenv').config();

module.exports = async (req, res, next) => {
  // Bypassed user definition (default demo)
  const defaultUser = {
    id: 1,
    name: 'Demo User',
    email: 'demo@sendkit.com',
    role: 'admin',
    quota: 1000,
    api_key: 'sk_demo_key_998877665544'
  };

  try {
    // Ambil user pertama dari database sebagai session aktif
    const [users] = await db.query('SELECT id, name, email, role, quota, api_key FROM users LIMIT 1');
    if (users && users.length > 0) {
      req.user = {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role,
        quota: users[0].quota,
        api_key: users[0].api_key
      };
      return next();
    }
  } catch (error) {
    console.log('Database offline/belum terhubung, menggunakan sesi user mock.');
  }

  // Fallback ke mock user jika DB offline/belum ada user
  req.user = defaultUser;
  next();
};
