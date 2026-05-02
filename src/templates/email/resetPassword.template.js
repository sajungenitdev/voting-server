const resetPasswordTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
        .content { background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🗳️ Voting Platform</div>
        </div>
        
        <div class="content">
          <h2>Hello ${name}! 👋</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">
              🔑 Reset Password
            </a>
          </div>
          
          <div class="warning">
            ⏰ This link is valid for <strong>10 minutes</strong>
          </div>
          
          <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #666; word-break: break-all;">${resetUrl}</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; 2024 Voting Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = resetPasswordTemplate;