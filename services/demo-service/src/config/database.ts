import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'demo_db';

let isConnected = false;

export const connectToDatabase = async (): Promise<void> => {
  if (isConnected) {
    console.log('[Database] Already connected to MongoDB');
    return;
  }

  try {
    console.log('[Database] Connecting to MongoDB...');
    console.log(`[Database] URI: ${MONGO_URI}`);
    console.log(`[Database] Database: ${MONGO_DB}`);

    await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('[Database] ✅ Successfully connected to MongoDB');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('[Database] ❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] ⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[Database] ✅ MongoDB reconnected');
      isConnected = true;
    });
  } catch (error) {
    console.error('[Database] ❌ Failed to connect to MongoDB:', error);
    isConnected = false;
    throw error;
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] Disconnected from MongoDB');
  } catch (error) {
    console.error('[Database] Error disconnecting from MongoDB:', error);
    throw error;
  }
};

export const getDatabaseStatus = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

