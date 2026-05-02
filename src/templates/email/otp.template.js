const otpTemplate = (name, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1a1a2e;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 0;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        
        .card {
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        
        .logo {
          font-size: 48px;
          margin-bottom: 10px;
        }
        
        .logo-text {
          font-size: 28px;
          font-weight: bold;
          letter-spacing: -0.5px;
        }
        
        .subtitle {
          font-size: 14px;
          opacity: 0.9;
          margin-top: 8px;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .greeting {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #1a1a2e;
        }
        
        .message {
          color: #4a5568;
          margin-bottom: 30px;
          font-size: 16px;
          line-height: 1.7;
        }
        
        .otp-container {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border-radius: 16px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
          border: 2px solid #e0e7ff;
        }
        
        .otp-label {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #667eea;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        .otp-code {
          font-family: 'Courier New', monospace;
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 12px;
          color: #4F46E5;
          background: white;
          padding: 20px;
          border-radius: 12px;
          display: inline-block;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .timer-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #fff3cd;
          padding: 10px 20px;
          border-radius: 50px;
          margin-top: 20px;
          font-size: 14px;
          color: #856404;
        }
        
        .info-box {
          background: #f8fafc;
          border-left: 4px solid #667eea;
          padding: 15px 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
          color: #94a3b8;
          font-size: 12px;
          margin: 5px 0;
        }
        
        .social-links {
          margin-top: 20px;
        }
        
        .social-links a {
          color: #94a3b8;
          text-decoration: none;
          margin: 0 10px;
          font-size: 12px;
        }
        
        @media (max-width: 480px) {
          .otp-code {
            font-size: 32px;
            letter-spacing: 8px;
          }
          .content {
            padding: 30px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo">🗳️</div>
            <div class="logo-text">Voting Platform</div>
            <div class="subtitle">Secure Online Voting System</div>
          </div>
          
          <div class="content">
            <div class="greeting">Hello ${name}! 👋</div>
            <div class="message">
              Thank you for choosing Voting Platform. To complete your registration and secure your account, please verify your email address using the following One-Time Password (OTP).
            </div>
            
            <div class="otp-container">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-code">${otp}</div>
              <div class="timer-badge">
                ⏰ Valid for 10 minutes
              </div>
            </div>
            
            <div class="info-box">
              <strong>💡 Security Tips:</strong><br>
              • Never share this OTP with anyone<br>
              • Voting Platform will never ask for your OTP<br>
              • If you didn't request this, please ignore this email
            </div>
            
            <div class="message" style="font-size: 14px; color: #64748b;">
              Need help? Contact our support team at <strong style="color: #667eea;">support@votingplatform.com</strong>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-text">© 2024 Voting Platform. All rights reserved.</div>
            <div class="footer-text">This is an automated message, please do not reply.</div>
            <div class="social-links">
              <a href="#">Twitter</a> • <a href="#">Facebook</a> • <a href="#">LinkedIn</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = otpTemplate;
