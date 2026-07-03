require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dbCheck = require('./middleware/dbCheck');

// Initialize app
const app = express();

// Connect to Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve uploaded screenshots (local only; Vercel uses ephemeral filesystem)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth routes are NOT behind dbCheck so login always works
app.use('/api/auth', authRoutes);

// Apply database connectivity check to protected API endpoints
app.use('/api', dbCheck);

// Protected User API Routes
app.use('/api', userRoutes);

// Admin API Routes
app.use('/api/admin', adminRoutes);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '../client')));

// Fallback to client/index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server only when run directly (not imported by Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection Error: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

// Export for Vercel serverless
module.exports = app;
