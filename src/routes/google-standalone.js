const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Google standalone route working' });
});

// One-Tap token endpoint
router.post('/token', async (req, res) => {
  console.log('=== GOOGLE STANDALONE ONE-TAP ===');
  
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ 
        success: false, 
        message: 'Credential is required' 
      });
    }
    
    console.log('Verifying token with Google...');
    
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    console.log('User verified:', email);
    
    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      console.log('Creating new user...');
      user = new User({
        name: name || email.split('@')[0],
        email,
        googleId,
        isVerified: true,
        avatar: picture,
        password: crypto.randomBytes(32).toString('hex'),
        statistics: {
          totalVotes: 0,
          totalPollsCreated: 0,
          totalComments: 0,
          joinDate: new Date(),
          lastActive: new Date(),
        },
      });
      await user.save();
      console.log('User created:', user._id);
    } else if (!user.googleId) {
      console.log('Linking Google account...');
      user.googleId = googleId;
      user.isVerified = true;
      if (picture) user.avatar = picture;
      user.lastLogin = new Date();
      if (user.statistics) {
        user.statistics.lastActive = new Date();
      }
      await user.save();
      console.log('User updated:', user._id);
    } else {
      console.log('Existing user logged in:', user._id);
      user.lastLogin = new Date();
      if (user.statistics) {
        user.statistics.lastActive = new Date();
      }
      await user.save();
    }
    
    // Generate JWT - Use JWT_ACCESS_SECRET from .env
    const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_ACCESS_SECRET is not defined in environment variables!');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error: JWT secret missing' 
      });
    }
    
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_ACCESS_EXPIRE || '7d' }
    );
    
    console.log('Login successful for:', email);
    
    return res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken,
      },
    });
    
  } catch (error) {
    console.error('Error in Google auth:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Google authentication failed'
    });
  }
});

module.exports = router;