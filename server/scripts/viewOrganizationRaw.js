/**
 * View raw organization data from database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}\n`);
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
};

const viewRawOrganization = async () => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('organizations');
        const organizations = await collection.find({}).toArray();
        
        console.log(`Found ${organizations.length} organization(s):\n`);
        
        organizations.forEach((org, index) => {
            console.log(`\n=== Organization ${index + 1} ===`);
            console.log(JSON.stringify(org, null, 2));
        });
        
    } catch (error) {
        console.error('❌ Error viewing organizations:', error.message);
    }
};

const main = async () => {
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    await viewRawOrganization();

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

