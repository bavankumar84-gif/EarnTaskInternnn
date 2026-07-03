const express = require('express');
const router = express.Router();
const { googleLogin, adminLogin } = require('../controllers/authController');

router.post('/google', googleLogin);
router.post('/admin-login', adminLogin);

// Get OAuth config details dynamically
router.get('/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

module.exports = router;
