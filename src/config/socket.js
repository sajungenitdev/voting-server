import { Server } from 'socket.io';
import env from './env.js';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });
  
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};