const axios = require('axios');
const db = require('../models/db');
const otpModel = require('../models/otpModel');

// Helper untuk mengambil Token dari DB
async function getGateways() {
  const [rows] = await db.query('SELECT fonnte_token, brevo_api_key FROM settings LIMIT 1');
  return rows[0] || { fonnte_token: '', brevo_api_key: '' };
}

// 1. Send WhatsApp via Fonnte
exports.sendWA = async (req, res) => {
  const { to, message } = req.body;
  const userId = req.user.id;

  if (!to || !message) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "to" (nomor WA) dan "message" wajib diisi.',
      data: {}
    });
  }

  try {
    const gateway = await getGateways();
    if (!gateway.fonnte_token) {
      return res.status(500).json({
        success: false,
        message: 'Pengaturan Token Fonnte belum dikonfigurasi oleh admin.',
        data: {}
      });
    }

    let status = 'failed';
    try {
      // Panggil API Fonnte
      const response = await axios.post(
        'https://fontee.or.id/api/send',
        {
          target: to,
          message: message
        },
        {
          headers: {
            'token': gateway.fonnte_token,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // timeout 10 detik
        }
      );

      // Fonnte mengembalikan response.data.status sebagai boolean atau string status
      if (response.data && (response.data.status === true || response.data.status === 'true' || response.data.detail === 'success')) {
        status = 'sent';
      } else {
        console.error('Fonnte API response warning:', response.data);
      }
    } catch (apiError) {
      console.error('Error calling Fonnte API:', apiError.message);
    }

    // Log pesan ke DB
    await db.query(
      'INSERT INTO messages_log (user_id, type, recipient, message, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'wa', to, message, status]
    );

    if (status === 'sent') {
      // Kurangi kuota user
      await db.query('UPDATE users SET quota = quota - 1 WHERE id = ?', [userId]);

      return res.status(200).json({
        success: true,
        message: 'Pesan WhatsApp berhasil dikirim.',
        data: { recipient: to, status }
      });
    } else {
      return res.status(502).json({
        success: false,
        message: 'Gagal mengirim pesan WhatsApp melalui Fonnte Gateway.',
        data: { recipient: to, status }
      });
    }

  } catch (error) {
    console.error('Error in sendWA controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengirim WhatsApp.',
      data: {}
    });
  }
};

// 2. Send Email via Brevo
exports.sendEmail = async (req, res) => {
  const { to, subject, message } = req.body;
  const userId = req.user.id;

  if (!to || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "to", "subject", dan "message" wajib diisi.',
      data: {}
    });
  }

  try {
    const gateway = await getGateways();
    if (!gateway.brevo_api_key) {
      return res.status(500).json({
        success: false,
        message: 'Pengaturan API Key Brevo belum dikonfigurasi oleh admin.',
        data: {}
      });
    }

    let status = 'failed';
    try {
      // Panggil API Brevo
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: 'SendKit', email: 'no-reply@sendkit.com' },
          to: [{ email: to }],
          subject: subject,
          htmlContent: message
        },
        {
          headers: {
            'api-key': gateway.brevo_api_key,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Brevo mengembalikan messageId jika sukses (status 201 Created)
      if (response.status === 201 || response.data.messageId) {
        status = 'sent';
      }
    } catch (apiError) {
      console.error('Error calling Brevo API:', apiError.response ? apiError.response.data : apiError.message);
    }

    // Log pesan ke DB
    await db.query(
      'INSERT INTO messages_log (user_id, type, recipient, message, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'email', to, `Subject: ${subject} | Content: ${message}`, status]
    );

    if (status === 'sent') {
      // Kurangi kuota
      await db.query('UPDATE users SET quota = quota - 1 WHERE id = ?', [userId]);

      return res.status(200).json({
        success: true,
        message: 'Email berhasil dikirim.',
        data: { recipient: to, status }
      });
    } else {
      return res.status(502).json({
        success: false,
        message: 'Gagal mengirim email melalui Brevo Gateway.',
        data: { recipient: to, status }
      });
    }

  } catch (error) {
    console.error('Error in sendEmail controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat mengirim email.',
      data: {}
    });
  }
};

// 3. Send OTP via WA
exports.sendOTPWA = async (req, res) => {
  const { to } = req.body;
  const userId = req.user.id;

  if (!to) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "to" (nomor WA) wajib diisi.',
      data: {}
    });
  }

  try {
    const gateway = await getGateways();
    if (!gateway.fonnte_token) {
      return res.status(500).json({
        success: false,
        message: 'Pengaturan Token Fonnte belum dikonfigurasi.',
        data: {}
      });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpMessage = `Kode OTP SendKit Anda adalah: *${otp}*. Kode ini rahasia dan berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.`;

    let status = 'failed';
    try {
      const response = await axios.post(
        'https://fontee.or.id/api/send',
        {
          target: to,
          message: otpMessage
        },
        {
          headers: {
            'token': gateway.fonnte_token,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && (response.data.status === true || response.data.status === 'true' || response.data.detail === 'success')) {
        status = 'sent';
      }
    } catch (apiError) {
      console.error('Error calling Fonnte API for OTP:', apiError.message);
    }

    // Log pesan ke DB
    await db.query(
      'INSERT INTO messages_log (user_id, type, recipient, message, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'wa', to, `[OTP Send] Kode: ${otp}`, status]
    );

    if (status === 'sent') {
      // Simpan ke tabel OTP (expires 5 menit)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await otpModel.createOTP(to, otp, expiresAt);

      // Kurangi kuota user
      await db.query('UPDATE users SET quota = quota - 1 WHERE id = ?', [userId]);

      return res.status(200).json({
        success: true,
        message: 'OTP berhasil dikirim via WhatsApp.',
        data: { recipient: to }
      });
    } else {
      return res.status(502).json({
        success: false,
        message: 'Gagal mengirim OTP melalui Fonnte Gateway.',
        data: { recipient: to }
      });
    }

  } catch (error) {
    console.error('Error in sendOTPWA:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat memproses OTP WA.',
      data: {}
    });
  }
};

// 4. Send OTP via Email
exports.sendOTPEmail = async (req, res) => {
  const { to } = req.body;
  const userId = req.user.id;

  if (!to) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "to" (email) wajib diisi.',
      data: {}
    });
  }

  try {
    const gateway = await getGateways();
    if (!gateway.brevo_api_key) {
      return res.status(500).json({
        success: false,
        message: 'Pengaturan API Key Brevo belum dikonfigurasi.',
        data: {}
      });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const subject = 'Kode OTP Verifikasi SendKit';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #0A0F1E; color: #fff;">
        <h2 style="color: #FF6B35; text-align: center;">SendKit OTP Verification</h2>
        <p>Halo,</p>
        <p>Anda telah meminta kode OTP untuk verifikasi. Silakan gunakan kode di bawah ini:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #FF6B35; padding: 10px 20px; background-color: #111827; border-radius: 6px; border: 1px solid #FF6B35;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #94a3b8; text-align: center;">Kode OTP ini hanya berlaku selama <b>5 menit</b>. Jangan sebarkan kode ini kepada siapa pun.</p>
        <hr style="border-color: #1e293b; margin-top: 30px;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">© 2026 SendKit Middleware Platform</p>
      </div>
    `;

    let status = 'failed';
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: 'SendKit OTP', email: 'no-reply@sendkit.com' },
          to: [{ email: to }],
          subject: subject,
          htmlContent: emailHtml
        },
        {
          headers: {
            'api-key': gateway.brevo_api_key,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status === 201 || response.data.messageId) {
        status = 'sent';
      }
    } catch (apiError) {
      console.error('Error calling Brevo API for OTP:', apiError.response ? apiError.response.data : apiError.message);
    }

    // Log pesan ke DB
    await db.query(
      'INSERT INTO messages_log (user_id, type, recipient, message, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'email', to, `[OTP Send] Kode: ${otp}`, status]
    );

    if (status === 'sent') {
      // Simpan ke tabel OTP (expires 5 menit)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await otpModel.createOTP(to, otp, expiresAt);

      // Kurangi kuota user
      await db.query('UPDATE users SET quota = quota - 1 WHERE id = ?', [userId]);

      return res.status(200).json({
        success: true,
        message: 'OTP berhasil dikirim via Email.',
        data: { recipient: to }
      });
    } else {
      return res.status(502).json({
        success: false,
        message: 'Gagal mengirim OTP melalui Brevo Gateway.',
        data: { recipient: to }
      });
    }

  } catch (error) {
    console.error('Error in sendOTPEmail:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat memproses OTP Email.',
      data: {}
    });
  }
};

// 5. Verify OTP
exports.verifyOTP = async (req, res) => {
  const { to, otp } = req.body;

  if (!to || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "to" (penerima) dan "otp" (6 digit kode) wajib diisi.',
      data: {}
    });
  }

  try {
    // Temukan OTP yang cocok dan valid
    const activeOtp = await otpModel.findValidOTP(to, otp);

    if (!activeOtp) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP tidak valid atau telah kedaluwarsa.',
        data: { verified: false }
      });
    }

    // Tandai OTP sebagai terverifikasi
    await otpModel.markAsVerified(activeOtp.id);

    return res.status(200).json({
      success: true,
      message: 'Verifikasi OTP berhasil. Kode valid.',
      data: { verified: true }
    });

  } catch (error) {
    console.error('Error in verifyOTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat memverifikasi OTP.',
      data: {}
    });
  }
};
