const resetPasswordTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
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
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        
        .lock-icon {
          font-size: 64px;
          background: white;
          width: 100px;
          height: 100px;
          line-height: 100px;
          border-radius: 50%;
          margin: 0 auto 20px;
          color: #f59e0b;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        
        .logo-text {
          font-size: 28px;
          font-weight: bold;
          letter-spacing: -0.5px;
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
          margin-bottom: 25px;
          font-size: 16px;
        }
        
        .warning-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
          color: white;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
        }
        
        .security-tips {
          background: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          margin: 25px 0;
        }
        
        .security-tips h4 {
          color: #1a1a2e;
          margin-bottom: 10px;
        }
        
        .security-tips ul {
          margin-left: 20px;
          color: #64748b;
          font-size: 14px;
        }
        
        .security-tips li {
          margin: 5px 0;
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
        
        @media (max-width: 480px) {
          .content {
            padding: 30px 20px;
          }
          .cta-button {
            padding: 14px 30px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="lock-icon">🔒</div>
            <div class="logo-text">Password Reset Request</div>
          </div>
          
          <div class="content">
            <div class="greeting">Hello ${name}! 👋</div>
            <div class="message">
              We received a request to reset the password for your Voting Platform account. Click the button below to create a new password.
            </div>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="cta-button">
                🔐 Reset My Password
              </a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Link Expires in 10 Minutes</strong><br>
              For security reasons, this password reset link will expire in 10 minutes.
            </div>
            
            <div class="security-tips">
              <h4>🛡️ Security Tips:</h4>
              <ul>
                <li>Create a strong, unique password</li>
                <li>Don't share your password with anyone</li>
                <li>Enable two-factor authentication for extra security</li>
                <li>Never click on suspicious links</li>
              </ul>
            </div>
            
            <div class="message" style="font-size: 14px; background: #fef2f2; padding: 15px; border-radius: 8px;">
              <strong>❓ Didn't request this?</strong><br>
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </div>
            
            <div class="message" style="font-size: 14px; margin-top: 20px; text-align: center;">
              <strong>Alternative Method:</strong><br>
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="color: #667eea; word-break: break-all;">${resetUrl}</span>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-text">© 2024 Voting Platform. All rights reserved.</div>
            <div class="footer-text">This is an automated security message</div>
            <div class="footer-text" style="margin-top: 10px;">
              Need help? Contact us at <strong>support@votingplatform.com</strong>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = resetPasswordTemplate;
