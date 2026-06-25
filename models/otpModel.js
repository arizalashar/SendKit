const db = require('./db');

// Simpan OTP Baru
exports.createOTP = async (recipient, otp, expiresAt) => {
  return db.query(
    'INSERT INTO otps (recipient, otp, expires_at) VALUES (?, ?, ?)',
    [recipient, otp, expiresAt]
  );
};

// Cari OTP yang valid (belum kedaluwarsa dan belum diverifikasi)
exports.findValidOTP = async (recipient, otp) => {
  const [rows] = await db.query(
    `SELECT * FROM otps 
     WHERE recipient = ? AND otp = ? AND expires_at > CURRENT_TIMESTAMP AND verified = 0 
     ORDER BY created_at DESC LIMIT 1`,
    [recipient, otp]
  );
  return rows[0] || null;
};

// Tandai OTP sebagai telah diverifikasi
exports.markAsVerified = async (id) => {
  return db.query('UPDATE otps SET verified = 1 WHERE id = ?', [id]);
};
