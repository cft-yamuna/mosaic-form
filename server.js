const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors());

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: "*", // In production, replace with your actual frontend URL
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id);

  // Listen for 'imagesent' event from client
  socket.on('imagesent', (data) => {
    console.log('📨 Received imagesent event:', data);
    console.log('User ID:', data.userId);

    // Broadcast the event to all connected clients (including the sender)
    io.emit('imagesent', data);
    console.log('📢 Broadcasted imagesent event to all clients');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Socket server running on http://localhost:${PORT}`);
  console.log('='.repeat(50));
});
