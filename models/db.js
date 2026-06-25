const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbName = process.env.DB_NAME || 'sendkit';

let pool;

async function initializeDatabase() {
  try {
    // 1. Koneksi awal tanpa nama database untuk membuat database jika belum ada
    const connection = await mysql.createConnection({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPass
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // 2. Buat connection pool menggunakan database target
    pool = mysql.createPool({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPass,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Database '${dbName}' connected & initialized.`);

    // 3. Buat tabel-tabel yang diperlukan
    await createTables();

  } catch (error) {
    console.error('Database initialization failed. Server will continue but DB requests will fail:', error.message);
  }
}

async function createTables() {
  const queries = [
    // Tabel Users
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      api_key VARCHAR(36) UNIQUE NOT NULL,
      quota INT DEFAULT 1000,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // Tabel Messages Log
    `CREATE TABLE IF NOT EXISTS messages_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('wa', 'email') NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;`,

    // Tabel Settings
    `CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fonnte_token VARCHAR(255),
      brevo_api_key VARCHAR(255)
    ) ENGINE=InnoDB;`,

    // Tabel OTPs
    `CREATE TABLE IF NOT EXISTS otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      verified TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`
  ];

  for (const query of queries) {
    await pool.query(query);
  }

  // Seeding awal tabel settings jika masih kosong
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM settings');
  if (rows[0].count === 0) {
    const fonnteToken = process.env.FONNTE_TOKEN || '';
    const brevoApiKey = process.env.BREVO_API_KEY || '';
    await pool.query(
      'INSERT INTO settings (fonnte_token, brevo_api_key) VALUES (?, ?)',
      [fonnteToken, brevoApiKey]
    );
    console.log('Seeded default settings from .env');
  }

  // Seeding akun demo bawaan jika tabel users masih kosong
  const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (userCount[0].count === 0) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const demoApiKey = 'sk_demo_key_998877665544';
    await pool.query(
      'INSERT INTO users (name, email, password, api_key, quota, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['Demo User', 'demo@sendkit.com', hashedPassword, demoApiKey, 1000, 'admin']
    );
    console.log('Seeded default demo user account: demo@sendkit.com / password123');
  }
}

// Inisialisasi dijalankan saat file di-load
initializeDatabase();

module.exports = {
  query: async (sql, params) => {
    if (!pool) {
      throw new Error('Koneksi database belum diinisialisasi atau gagal terhubung.');
    }
    return pool.query(sql, params);
  },
  getPool: () => pool
};
