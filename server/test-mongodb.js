import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './helpers/logger.js';

dotenv.config();

const testConnection = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    // Mask password in URI for logging
    const maskedURI = mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    logger.info('🔌 Connecting to MongoDB:', { uri: maskedURI });
    
    await mongoose.connect(mongoURI);
    logger.info('✅ MongoDB connected successfully!');
    
    // Test database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    logger.info('📁 Collections found:', { count: collections.length });
    if (collections.length > 0) {
      logger.info('   Collections:', { collections: collections.map(c => c.name).join(', ') });
    } else {
      logger.info('   (No collections yet - database is empty)');
    }
    
    // Test database name
    logger.info('📊 Database name:', { databaseName: db.databaseName });
    
    await mongoose.connection.close();
    logger.info('✅ Connection closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ MongoDB connection failed!');
    logger.error('   Error:', { error: error.message });
    logger.error('\n💡 Troubleshooting:');
    logger.error('   1. Ensure MongoDB is running');
    logger.error('   2. Check MONGO_URI in .env file');
    logger.error('   3. Verify MongoDB service is started');
    logger.error('   4. Check MongoDB logs for errors');
    process.exit(1);
  }
};

testConnection();

