import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const testConnection = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    // Mask password in URI for logging
    const maskedURI = mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log('🔌 Connecting to MongoDB:', maskedURI);
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully!');
    
    // Test database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections found:', collections.length);
    if (collections.length > 0) {
      console.log('   Collections:', collections.map(c => c.name).join(', '));
    } else {
      console.log('   (No collections yet - database is empty)');
    }
    
    // Test database name
    console.log('📊 Database name:', db.databaseName);
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('   Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running');
    console.error('   2. Check MONGO_URI in .env file');
    console.error('   3. Verify MongoDB service is started');
    console.error('   4. Check MongoDB logs for errors');
    process.exit(1);
  }
};

testConnection();

