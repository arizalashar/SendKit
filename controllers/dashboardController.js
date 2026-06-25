const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

// 1. Ambil Profil User
exports.getProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const [users] = await db.query(
      'SELECT name, email, api_key, quota, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.',
        data: {}
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diambil.',
      data: users[0]
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengambil profil.',
      data: {}
    });
  }
};

// 2. Ambil Riwayat Pesan (Logs)
exports.getLogs = async (req, res) => {
  const userId = req.user.id;
  const { type, status } = req.query;

  try {
    let sql = 'SELECT * FROM messages_log WHERE user_id = ?';
    const params = [userId];

    if (type === 'wa' || type === 'email') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status === 'sent' || status === 'failed' || status === 'pending') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sent_at DESC LIMIT 100'; // Batasi 100 data terakhir

    const [logs] = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Riwayat log berhasil diambil.',
      data: logs
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengambil log.',
      data: {}
    });
  }
};

// 3. Ambil Statistik Dashboard
exports.getStats = async (req, res) => {
  const userId = req.user.id;

  try {
    // Total terkirim per tipe & status
    const [statsRows] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN type = 'wa' THEN 1 ELSE 0 END) as wa_total,
        SUM(CASE WHEN type = 'email' THEN 1 ELSE 0 END) as email_total
       FROM messages_log 
       WHERE user_id = ?`,
      [userId]
    );

    const stats = statsRows[0] || { total: 0, success: 0, failed: 0, wa_total: 0, email_total: 0 };
    const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100;

    // Ambil statistik tren 7 hari terakhir untuk Chart.js
    const [chartRows] = await db.query(
      `SELECT 
        DATE_FORMAT(sent_at, '%Y-%m-%d') as date,
        SUM(CASE WHEN type = 'wa' AND status = 'sent' THEN 1 ELSE 0 END) as wa_success,
        SUM(CASE WHEN type = 'email' AND status = 'sent' THEN 1 ELSE 0 END) as email_success
       FROM messages_log
       WHERE user_id = ? AND sent_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(sent_at, '%Y-%m-%d')
       ORDER BY date ASC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Statistik berhasil diambil.',
      data: {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        wa_total: stats.wa_total,
        email_total: stats.email_total,
        success_rate: successRate,
        chart: chartRows
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengambil statistik.',
      data: {}
    });
  }
};

// 4. Regenerasi API Key
exports.regenerateApiKey = async (req, res) => {
  const userId = req.user.id;
  const newApiKey = uuidv4();

  try {
    await db.query('UPDATE users SET api_key = ? WHERE id = ?', [newApiKey, userId]);

    return res.status(200).json({
      success: true,
      message: 'API Key berhasil diperbarui.',
      data: { api_key: newApiKey }
    });

  } catch (error) {
    console.error('Error regenerating API Key:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat meregenerasi API Key.',
      data: {}
    });
  }
};

// 5. Ambil Pengaturan Gateway (Admin Only)
exports.getSettings = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Endpoint ini hanya untuk admin.',
      data: {}
    });
  }

  try {
    const [rows] = await db.query('SELECT fonnte_token, brevo_api_key FROM settings LIMIT 1');
    const settings = rows[0] || { fonnte_token: '', brevo_api_key: '' };

    return res.status(200).json({
      success: true,
      message: 'Pengaturan berhasil diambil.',
      data: settings
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengambil pengaturan.',
      data: {}
    });
  }
};

// 6. Perbarui Pengaturan Gateway (Admin Only)
exports.updateSettings = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Endpoint ini hanya untuk admin.',
      data: {}
    });
  }

  const { fonnte_token, brevo_api_key } = req.body;

  try {
    // Cari baris settings
    const [rows] = await db.query('SELECT id FROM settings LIMIT 1');

    if (rows.length === 0) {
      // Jika kosong, insert
      await db.query(
        'INSERT INTO settings (fonnte_token, brevo_api_key) VALUES (?, ?)',
        [fonnte_token || '', brevo_api_key || '']
      );
    } else {
      // Jika ada, update
      await db.query(
        'UPDATE settings SET fonnte_token = ?, brevo_api_key = ? WHERE id = ?',
        [fonnte_token || '', brevo_api_key || '', rows[0].id]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Pengaturan gateway berhasil diperbarui.',
      data: { fonnte_token, brevo_api_key }
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat menyimpan pengaturan.',
      data: {}
    });
  }
};
