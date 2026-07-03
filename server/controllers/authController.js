const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

let client;
if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.startsWith('your_google')) {
  client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

// Helper to sign JWT
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'your_jwt_super_secret_key_12345',
    { expiresIn: '7d' }
  );
};

// @desc    Google OAuth Login / Register (Loyal users only)
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ success: false, message: 'Google credential token is required' });
  }

  try {
    if (!client) {
      return res.status(500).json({ 
        success: false, 
        message: 'Google Client ID is not configured on the server.' 
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    // Check if user exists
    let user = await User.findOne({ googleId });

    if (!user) {
      // Create new user with default 'user' role
      user = await User.create({
        googleId,
        email,
        name,
        picture,
        role: 'user'
      });

      // Create initial empty Wallet for user
      await Wallet.create({
        userId: user._id,
        balance: 0,
        totalEarned: 0
      });
    }

    const token = signToken(user);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        role: user.role,
        phone: user.phone,
        upiId: user.upiId
      }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google credential token' });
  }
};

// @desc    Admin Local Credentials Login
// @route   POST /api/auth/admin-login
// @access  Public
const adminLogin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide admin email and password' });
  }

  // Check specific credentials
  if (email !== 'admin@earntask.com' || password !== 'Admin@123') {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  try {
    // Check if admin user exists by email
    let adminUser = await User.findOne({ email: 'admin@earntask.com' });
    
    const targetName = 'Admin';
    const targetPicture = 'https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=6366f1&textColor=ffffff';

    if (!adminUser) {
      adminUser = await User.create({
        googleId: 'admin_local_account',
        email: 'admin@earntask.com',
        name: targetName,
        picture: targetPicture,
        role: 'admin'
      });

      // Create initial empty Wallet for admin
      await Wallet.create({
        userId: adminUser._id,
        balance: 0,
        totalEarned: 0
      });
    } else if (adminUser.name !== targetName || adminUser.picture !== targetPicture) {
      // Auto-update to target name and professional picture
      adminUser.name = targetName;
      adminUser.picture = targetPicture;
      await adminUser.save();
    }

    const token = signToken(adminUser);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        picture: adminUser.picture,
        role: adminUser.role,
        phone: adminUser.phone,
        upiId: adminUser.upiId
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleLogin,
  adminLogin
};
