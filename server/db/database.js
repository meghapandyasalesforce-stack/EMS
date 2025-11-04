import mongoose from "mongoose";

const connectDB = async (retries = 5, delay = 5000) => { 
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting MongoDB connection (${i + 1}/${retries})...`);
            await mongoose.connect(mongoURI);
            console.log("MongoDB connected successfully");
            
            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err);
            });
            
            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected');
            });
            
            // Graceful shutdown
            process.on('SIGINT', async () => {
                await mongoose.connection.close();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            });
            process.on('SIGTERM', async () => {
                await mongoose.connection.close();
                console.log('MongoDB connection closed due to SIGTERM');
                process.exit(0);
            });
            
            return; // Success, exit retry loop
            
        } catch (error) {
            console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ All MongoDB connection attempts failed');
                process.exit(1);
            }
        }
    }
}

export default connectDB;