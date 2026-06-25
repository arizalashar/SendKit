const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'sendkit_jwt_secret_key_2026';

// Register User
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  // Validasi Input
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nama, email, dan password wajib diisi.',
      data: {}
    });
  }

  try {
    // Periksa apakah email sudah terdaftar
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar. Silakan gunakan email lain.',
        data: {}
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Hasilkan API Key UUID
    const apiKey = uuidv4();

    // Cek apakah ini user pertama terdaftar. Jika ya, jadikan 'admin', jika tidak 'user'.
    const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
    const role = userCount[0].count === 0 ? 'admin' : 'user';

    // Tentukan kuota awal (1000 pesan)
    const defaultQuota = 1000;

    // Simpan user baru ke database
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, api_key, quota, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, apiKey, defaultQuota, role]
    );

    return res.status(201).json({
      success: true,
      message: 'Registrasi akun berhasil.',
      data: {
        id: result.insertId,
        name,
        email,
        api_key: apiKey,
        quota: defaultQuota,
        role
      }
    });

  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat registrasi akun.',
      data: {}
    });
  }
};

// Login User
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // Validasi Input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi.',
      data: {}
    });
  }

  try {
    // Cari user berdasarkan email
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
        data: {}
      });
    }

    const user = users[0];

    // Bandingkan password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.',
        data: {}
      });
    }

    // Buat JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login.',
      data: {}
    });
  }
};
