const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authJWT = require('../middleware/authJWT');

// Semua route di sini dilindungi oleh JWT auth
router.use(authJWT);

// Route Profil & API Key
router.get('/profile', dashboardController.getProfile);
router.post('/regenerate-key', dashboardController.regenerateApiKey);

// Route Statistik & Logs
router.get('/logs', dashboardController.getLogs);
router.get('/stats', dashboardController.getStats);

// Route Pengaturan Gateway (Admin Only)
router.get('/settings', dashboardController.getSettings);
router.post('/settings', dashboardController.updateSettings);

module.exports = router;
