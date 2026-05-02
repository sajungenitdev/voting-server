const welcomeTemplate = (name) => {
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
        .features { margin: 30px 0; }
        .feature { margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🗳️ Voting Platform</div>
        </div>
        
        <div class="content">
          <h2>Welcome ${name}! 🎉</h2>
          <p>Thank you for verifying your email! Your account has been successfully activated.</p>
          
          <div class="features">
            <h3>You can now:</h3>
            <div class="feature">✅ Create and participate in polls</div>
            <div class="feature">✅ View real-time voting results</div>
            <div class="feature">✅ Comment and react to polls</div>
            <div class="feature">✅ Track your voting history</div>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/polls" class="button">
              Explore Polls 🗳️
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>Happy Voting! 🎯</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = welcomeTemplate;