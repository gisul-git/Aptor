import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectToDatabase } from './config/database';
import { initializeSendGrid } from './config/sendgrid';
import demoRoutes from './routes/demoRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3008;

// Initialize services
initializeSendGrid();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'demo-service',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/demo', demoRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectToDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Demo Service running on port ${PORT}`);
      console.log(`📧 SendGrid initialized: ${process.env.SENDGRID_API_KEY ? 'Yes' : 'No'}`);
      console.log(`📬 Notification email: ${process.env.NOTIFICATION_EMAIL || 'info@aaptor.com'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // Close database connection if needed
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  // Close database connection if needed
  process.exit(0);
});

startServer();

