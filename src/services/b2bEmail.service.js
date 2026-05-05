const nodemailer = require("nodemailer");
require("dotenv").config();

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send OTP verification email (FIRST EMAIL)
const sendOTPEmail = async (email, otp, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      '"Voting Platform B2B" <noreply@votingplatform.com>',
    to: email,
    subject: "🔐 Verify Your B2B Data Access Request",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: #f8f9fa; }
          .otp-code { font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #4F46E5; background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏢 Voting Platform B2B</h2>
            <p>Data Access Request Verification</p>
          </div>
          <div class="content">
            <h3>Hello ${name},</h3>
            <p>Thank you for submitting a data access request. Please use the following OTP to verify your email address:</p>
            <div class="otp-code">${otp}</div>
            <p>⏰ This OTP is valid for <strong>10 minutes</strong>.</p>
            <p>If you didn't make this request, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Voting Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 OTP email sent to ${email}`);
};

// Send welcome email with credentials (SECOND EMAIL - After OTP verification)
const sendWelcomeCredentialsEmail = async (email, password, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      '"Voting Platform B2B" <noreply@votingplatform.com>',
    to: email,
    subject: "🎉 Welcome to Voting Platform B2B - Your Account Credentials",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .credentials { background: #f0f0ff; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .password-box { background: #e9ecef; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; }
          .button { background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏢 Voting Platform B2B</h2>
            <p>Your Account Has Been Created!</p>
          </div>
          <div style="padding: 30px;">
            <h3>Hello ${name}!</h3>
            <p>Your email has been verified successfully. Here are your account credentials:</p>
            <div class="credentials">
              <p><strong>📧 Email:</strong> ${email}</p>
              <div class="password-box">
                <strong>🔑 Password:</strong> ${password}
              </div>
            </div>
            <div style="text-align: center;">
              <a href="${process.env.B2B_FRONTEND_URL || "http://localhost:3001"}/login" class="button">
                Login to Your Account
              </a>
            </div>
            <p><strong>⚠️ Important:</strong> Please change your password after first login.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Welcome credentials email sent to ${email}`);
};

// Send subscription confirmation email
const sendSubscriptionConfirmation = async (email, name, tier, amount) => {
  const transporter = createTransporter();

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      '"Voting Platform B2B" <noreply@votingplatform.com>',
    to: email,
    subject: "✅ Subscription Confirmed - Voting Platform B2B",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: #f8f9fa; }
          .button { background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Subscription Confirmed!</h2>
            <p>${tier} Plan Activated</p>
          </div>
          <div class="content">
            <h3>Hello ${name},</h3>
            <p>Your subscription to the <strong>${tier} Plan</strong> has been successfully activated.</p>
            <p><strong>💰 Amount Paid:</strong> $${amount}</p>
            <p><strong>📅 Valid For:</strong> 30 days</p>
            <p>You now have access to premium voting data categories based on your plan.</p>
            <div style="text-align: center;">
              <a href="${process.env.B2B_FRONTEND_URL || "http://localhost:3001"}/dashboard" class="button">
                Go to Dashboard
              </a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Voting Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Subscription confirmation email sent to ${email}`);
};

// Send subscription invoice email with payment details
const sendSubscriptionInvoiceEmail = async (
  email,
  name,
  subscriptionDetails,
) => {
  const transporter = createTransporter();

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      '"Voting Platform B2B" <billing@votingplatform.com>',
    to: email,
    subject: "🧾 Your Subscription Invoice & Payment Confirmation",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: #f8f9fa; }
          .invoice-box { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .invoice-header { border-bottom: 2px solid #28a745; padding-bottom: 10px; margin-bottom: 20px; }
          .invoice-details { margin: 20px 0; }
          .invoice-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .total { font-size: 18px; font-weight: bold; color: #28a745; margin-top: 15px; padding-top: 15px; border-top: 2px solid #28a745; }
          .button { background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .payment-status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-success { background: #d4edda; color: #155724; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🧾 Payment Confirmation</h2>
            <p>Thank you for your purchase!</p>
          </div>
          <div class="content">
            <h3>Hello ${name},</h3>
            <p>Your subscription payment has been successfully processed. Below are your invoice details:</p>
            
            <div class="invoice-box">
              <div class="invoice-header">
                <h3>📄 INVOICE</h3>
                <p><strong>Invoice #:</strong> ${subscriptionDetails.invoiceNumber}</p>
                <p><strong>Transaction ID:</strong> ${subscriptionDetails.transactionId}</p>
                <p><strong>Date:</strong> ${subscriptionDetails.date}</p>
              </div>
              
              <div class="invoice-details">
                <div class="invoice-row">
                  <span><strong>Plan</strong></span>
                  <span><strong>${subscriptionDetails.plan} Plan</strong></span>
                </div>
                <div class="invoice-row">
                  <span>Subscription Period</span>
                  <span>30 days</span>
                </div>
                <div class="invoice-row">
                  <span>Valid Until</span>
                  <span>${subscriptionDetails.validUntil}</span>
                </div>
                <div class="invoice-row">
                  <span>Payment Method</span>
                  <span>${subscriptionDetails.paymentMethod.toUpperCase()}</span>
                </div>
                ${
                  subscriptionDetails.cardLast4
                    ? `
                <div class="invoice-row">
                  <span>Card</span>
                  <span>•••• ${subscriptionDetails.cardLast4}</span>
                </div>
                `
                    : ""
                }
                <div class="invoice-row">
                  <span>Subtotal</span>
                  <span>$${subscriptionDetails.subtotal || subscriptionDetails.amount}</span>
                </div>
                ${
                  subscriptionDetails.taxAmount > 0
                    ? `
                <div class="invoice-row">
                  <span>Tax (10%)</span>
                  <span>$${subscriptionDetails.taxAmount}</span>
                </div>
                `
                    : ""
                }
                <div class="invoice-row total">
                  <span><strong>Total Paid</strong></span>
                  <span><strong>$${subscriptionDetails.totalAmount || subscriptionDetails.amount}</strong></span>
                </div>
                <div class="invoice-row">
                  <span>Status</span>
                  <span><span class="payment-status status-success">✓ PAID</span></span>
                </div>
              </div>
            </div>
            
            <p><strong>What's included in your ${subscriptionDetails.plan} Plan:</strong></p>
            <ul>
              ${
                subscriptionDetails.plan === "Basic"
                  ? `
                <li>✅ Access to 4 data categories</li>
                <li>✅ Basic analytics dashboard</li>
                <li>✅ Email support</li>
                <li>✅ Monthly reports</li>
                <li>✅ API access (1000 requests/day)</li>
              `
                  : subscriptionDetails.plan === "Standard"
                    ? `
                <li>✅ Access to 8 data categories</li>
                <li>✅ Advanced analytics dashboard</li>
                <li>✅ Priority support (24hr response)</li>
                <li>✅ Weekly reports</li>
                <li>✅ API access (5000 requests/day)</li>
                <li>✅ Data export (CSV/JSON)</li>
              `
                    : `
                <li>✅ Full access to ALL data categories</li>
                <li>✅ Premium analytics dashboard</li>
                <li>✅ 24/7 dedicated support</li>
                <li>✅ Real-time data streaming</li>
                <li>✅ Custom reports & insights</li>
                <li>✅ Unlimited API access</li>
                <li>✅ White-label solution</li>
                <li>✅ SLA agreement</li>
              `
              }
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.B2B_FRONTEND_URL || "http://localhost:3001"}/dashboard" class="button">
                🚀 Go to Dashboard
              </a>
            </div>
            
            <p><strong>Need help?</strong> Contact our billing team at billing@votingplatform.com</p>
          </div>
          <div class="footer">
            <p>© 2024 Voting Platform. All rights reserved.</p>
            <p>This is a system generated invoice. For disputes, contact within 7 days.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Subscription invoice email sent to ${email}`);
};

// Send payment confirmation email
const sendPaymentConfirmationEmail = async (email, name, paymentDetails) => {
  const transporter = createTransporter();

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      '"Voting Platform B2B" <billing@votingplatform.com>',
    to: email,
    subject: "✅ Payment Confirmation - Voting Platform B2B",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: #f8f9fa; }
          .payment-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .button { background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Payment Confirmed!</h2>
            <p>${paymentDetails.tier} Plan Activated</p>
          </div>
          <div class="content">
            <h3>Hello ${name},</h3>
            <p>Your payment of <strong>$${paymentDetails.amount}</strong> has been successfully processed.</p>
            
            <div class="payment-details">
              <h4>💰 Payment Summary:</h4>
              <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId}</p>
              <p><strong>Amount Paid:</strong> $${paymentDetails.amount} / ৳${paymentDetails.amountBDT}</p>
              <p><strong>Payment Method:</strong> ${paymentDetails.paymentMethod}</p>
              <p><strong>Plan:</strong> ${paymentDetails.tier} Plan</p>
              <p><strong>Valid Until:</strong> ${paymentDetails.endDate}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.B2B_FRONTEND_URL || "http://localhost:3001"}/dashboard" class="button">
                Access Your Dashboard
              </a>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Voting Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Payment confirmation email sent to ${email}`);
};

module.exports = {
  sendOTPEmail,
  sendWelcomeCredentialsEmail,
  sendSubscriptionConfirmation,
  sendSubscriptionInvoiceEmail, // NEW
  sendPaymentConfirmationEmail, // NEW
};
