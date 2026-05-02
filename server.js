const http = require('http');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/database');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.io connection handling
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userId || socket.id}`);
  
  if (socket.userId) {
    socket.join(`user_${socket.userId}`);
  }
  
  socket.on('vote-cast', (data) => {
    socket.broadcast.emit('vote-update', data);
  });
  
  socket.on('poll-update', (data) => {
    io.emit('poll-changed', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.userId || socket.id}`);
  });
});

// Connect to database and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server is running!
    ════════════════════════════════════════
    📡 Port: ${PORT}
    🌍 Environment: ${process.env.NODE_ENV || 'development'}
    🔗 API URL: http://localhost:${PORT}/api/v1
    💚 Health Check: http://localhost:${PORT}/health
    📡 Socket.io: ws://localhost:${PORT}
    🗄️  MongoDB: Atlas Connected
    ════════════════════════════════════════
    `);
  });
}).catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});