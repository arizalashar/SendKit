const rateLimit = require('express-rate-limit');
const db = require('../models/db');

// Rate Limiter per API Key (maks 100 request per jam)
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 100,
  keyGenerator: (req) => {
    // Membatasi berdasarkan header x-api-key, fallback ke IP jika tidak ada
    return req.headers['x-api-key'] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Batas pemakaian API terlampaui. Maksimal 100 request per jam.',
      data: {}
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Verifikasi API Key ke Database & Cek Kuota
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak. Header x-api-key tidak ditemukan.',
      data: {}
    });
  }

  try {
    const [users] = await db.query(
      'SELECT id, name, email, quota, role FROM users WHERE api_key = ?',
      [apiKey]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'API key tidak valid.',
        data: {}
      });
    }

    const user = users[0];

    // Cek apakah kuota masih mencukupi
    if (user.quota <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Kuota pengiriman pesan Anda telah habis (0). Silakan hubungi admin.',
        data: {}
      });
    }

    // Lampirkan user ke request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error verifying API Key:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal pada autentikasi API Key.',
      data: {}
    });
  }
}

module.exports = {
  apiKeyLimiter,
  apiKeyAuth
};
