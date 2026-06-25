const express = require('express');
const router = express.Router();
const sendController = require('../controllers/sendController');
const { apiKeyLimiter, apiKeyAuth } = require('../middleware/apiKeyAuth');

// Proteksi global untuk semua sub-route /api dengan middleware API Key & Rate Limit
router.use(apiKeyLimiter);
router.use(apiKeyAuth);

// Endpoint Pengiriman Pesan
router.post('/send/wa', sendController.sendWA);
router.post('/send/email', sendController.sendEmail);

// Endpoint Pengiriman OTP
router.post('/send/otp/wa', sendController.sendOTPWA);
router.post('/send/otp/email', sendController.sendOTPEmail);

// Endpoint Verifikasi OTP (juga dilindungi API Key)
router.post('/verify/otp', sendController.verifyOTP);

module.exports = router;
