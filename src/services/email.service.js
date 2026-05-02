const nodemailer = require('nodemailer');
require('dotenv').config();

// Import templates
const otpTemplate = require('../templates/email/otp.template');
const welcomeTemplate = require('../templates/email/welcome.template');
const resetPasswordTemplate = require('../templates/email/resetPassword.template');

// Email configuration
const emailConfig = {
  from: process.env.EMAIL_FROM || '"Voting Platform" <noreply@votingplatform.com>',
  company: 'Voting Platform',
  supportEmail: 'support@votingplatform.com'
};

// Transporter variable
let transporter = null;
let useRealEmail = false;
let initializationPromise = null;

// Create Gmail transporter
async function createGmailTransporter() {
  try {
    const testTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    await testTransporter.verify();
    return testTransporter;
  } catch (error) {
    console.error('❌ Gmail authentication failed:', error.message);
    return null;
  }
}

// Create Ethereal transporter (for testing)
async function createEtherealTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  const etherealTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  
  console.log('✅ Using Ethereal (fake email for testing)');
  console.log(`📧 Preview emails at: https://ethereal.email/login`);
  console.log(`   Login: ${testAccount.user}`);
  console.log(`   Password: ${testAccount.pass}`);
  
  return etherealTransporter;
}

// Initialize email service
async function initializeEmailService() {
  // If already initialized, return
  if (transporter) return transporter;
  
  // Try Gmail first if credentials exist
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
      process.env.EMAIL_USER !== 'your_email@gmail.com') {
    
    const gmailTransporter = await createGmailTransporter();
    if (gmailTransporter) {
      transporter = gmailTransporter;
      useRealEmail = true;
      console.log('✅ Gmail ready to send REAL emails');
      console.log(`📧 Using account: ${process.env.EMAIL_USER}`);
      return transporter;
    }
  }
  
  // Fallback to Ethereal
  transporter = await createEtherealTransporter();
  useRealEmail = false;
  return transporter;
}

// Ensure transporter is initialized before sending emails
async function ensureTransporter() {
  if (!transporter) {
    await initializeEmailService();
  }
  return transporter;
}

// Send OTP email
const sendOTPEmail = async (email, otp, name) => {
  try {
    await ensureTransporter();
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: '🔐 Verify Your Email - Voting Platform',
      html: otpTemplate(name, otp),
      text: `Your OTP verification code is: ${otp}\nValid for 10 minutes.`
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (!useRealEmail) {
      console.log(`📧 OTP email preview: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      console.log(`✅ OTP email sent to ${email}`);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error.message);
    throw error;
  }
};

// Send password reset email
const sendResetPasswordEmail = async (email, resetUrl, name) => {
  try {
    await ensureTransporter();
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: '🔑 Reset Your Password - Voting Platform',
      html: resetPasswordTemplate(name, resetUrl),
      text: `Reset your password by visiting: ${resetUrl}\nValid for 10 minutes.`
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (!useRealEmail) {
      console.log(`📧 Reset email preview: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      console.log(`✅ Password reset email sent to ${email}`);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send reset email:', error.message);
    throw error;
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, name) => {
  try {
    await ensureTransporter();
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: '🎉 Welcome to Voting Platform!',
      html: welcomeTemplate(name),
      text: `Welcome ${name}! Your email has been verified successfully.`
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (!useRealEmail) {
      console.log(`📧 Welcome email preview generated`);
    } else {
      console.log(`✅ Welcome email sent to ${email}`);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, subject, template, data) => {
  await ensureTransporter();
  
  const results = [];
  for (const recipient of recipients) {
    try {
      const mailOptions = {
        from: emailConfig.from,
        to: recipient.email,
        subject: subject,
        html: template(recipient.name, data),
        text: `Check your voting platform for updates.`
      };
      
      const info = await transporter.sendMail(mailOptions);
      results.push({ email: recipient.email, success: true, messageId: info.messageId });
    } catch (error) {
      results.push({ email: recipient.email, success: false, error: error.message });
    }
  }
  return results;
};

// Initialize on module load (async but don't block)
initializeEmailService().catch(console.error);

module.exports = {
  sendOTPEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendBulkEmail,
  isRealEmail: () => useRealEmail,
  getTransporter: () => transporter,
  initializeEmailService
};