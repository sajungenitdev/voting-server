const welcomeTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Voting Platform</title>
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 50px 30px;
          text-align: center;
          color: white;
        }
        
        .checkmark {
          font-size: 64px;
          background: white;
          width: 100px;
          height: 100px;
          line-height: 100px;
          border-radius: 50%;
          margin: 0 auto 20px;
          color: #4F46E5;
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
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #1a1a2e;
          text-align: center;
        }
        
        .message {
          color: #4a5568;
          margin-bottom: 30px;
          font-size: 16px;
          text-align: center;
        }
        
        .features {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 35px 0;
        }
        
        .feature-card {
          background: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          transition: transform 0.2s;
        }
        
        .feature-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }
        
        .feature-title {
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 5px;
        }
        
        .feature-desc {
          font-size: 12px;
          color: #64748b;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 40px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          margin: 20px 0;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .stats {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          padding: 25px;
          border-radius: 16px;
          margin: 25px 0;
          text-align: center;
        }
        
        .stats-number {
          font-size: 36px;
          font-weight: bold;
          color: #4F46E5;
        }
        
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        @media (max-width: 480px) {
          .features {
            grid-template-columns: 1fr;
            gap: 15px;
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
            <div class="checkmark">✅</div>
            <div class="logo-text">Welcome Aboard!</div>
          </div>
          
          <div class="content">
            <div class="greeting">🎉 Welcome, ${name}! 🎉</div>
            <div class="message">
              Your email has been successfully verified. You're now ready to participate in secure, transparent, and real-time voting.
            </div>
            
            <div class="features">
              <div class="feature-card">
                <div class="feature-icon">🗳️</div>
                <div class="feature-title">Create Polls</div>
                <div class="feature-desc">Create and manage your own polls</div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">📊</div>
                <div class="feature-title">Real-time Results</div>
                <div class="feature-desc">Watch votes update live</div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">💬</div>
                <div class="feature-title">Comments & Reactions</div>
                <div class="feature-desc">Engage with other voters</div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <div class="feature-title">Secure & Transparent</div>
                <div class="feature-desc">Your vote is safe with us</div>
              </div>
            </div>
            
            <div class="stats">
              <div class="stats-number">10,000+</div>
              <div style="color: #4a5568;">Active Polls Created</div>
              <div class="stats-number" style="font-size: 24px; margin-top: 15px;">50,000+</div>
              <div style="color: #4a5568;">Votes Cast</div>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/polls" class="cta-button">
                🚀 Start Exploring Polls
              </a>
            </div>
          </div>
          
          <div class="footer">
            <div style="margin-bottom: 15px;">
              <span style="margin: 0 10px;">📧 support@votingplatform.com</span>
              <span style="margin: 0 10px;">🐦 @VotingPlatform</span>
            </div>
            <div class="footer-text">© 2024 Voting Platform. All rights reserved.</div>
            <div class="footer-text" style="margin-top: 10px;">
              <a href="#" style="color: #94a3b8; text-decoration: none;">Privacy Policy</a> • 
              <a href="#" style="color: #94a3b8; text-decoration: none;">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = welcomeTemplate;
