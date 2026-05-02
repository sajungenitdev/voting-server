const otpTemplate = (name, otp) => {
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
        .otp-code { background: #f0f0ff; padding: 20px; text-align: center; margin: 25px 0; border-radius: 10px; }
        .otp-code span { font-size: 36px; letter-spacing: 10px; font-weight: bold; color: #4F46E5; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🗳️ Voting Platform</div>
          <p style="color: #666;">Secure Online Voting System</p>
        </div>
        
        <div class="content">
          <h2>Hello ${name}! 👋</h2>
          <p>Thank you for registering with Voting Platform. Please use the following OTP to verify your email address:</p>
          
          <div class="otp-code">
            <span>${otp}</span>
          </div>
          
          <div class="warning">
            ⏰ This OTP is valid for <strong>10 minutes</strong>
          </div>
          
          <p>If you didn't request this, please ignore this email.</p>
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

module.exports = otpTemplate;
