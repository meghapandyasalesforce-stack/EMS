/**
 * Utility script to list all databases and their collections
 * Usage: node server/scripts/listDatabases.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        // Connect to admin database to list all databases
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully\n');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
};

const listAllDatabases = async () => {
    try {
        const adminDb = mongoose.connection.db.admin();
        const { databases } = await adminDb.listDatabases();
        
        console.log('📊 MongoDB Databases:\n');
        console.log(`Total Databases: ${databases.length}\n`);
        console.log('='.repeat(60));
        
        for (const dbInfo of databases) {
            // Skip system databases
            if (dbInfo.name.startsWith('admin') || 
                dbInfo.name.startsWith('local') || 
                dbInfo.name.startsWith('config')) {
                continue;
            }
            
            console.log(`\n📁 Database: ${dbInfo.name}`);
            console.log(`   Size: ${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   Empty: ${dbInfo.empty ? 'Yes' : 'No'}`);
            
            // Get collections for this database
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            
            console.log(`   Collections: ${collections.length}`);
            
            if (collections.length > 0) {
                console.log(`   Collection Names:`);
                for (const collection of collections) {
                    try {
                        const docCount = await db.db.collection(collection.name).countDocuments();
                        console.log(`      - ${collection.name} (${docCount} documents)`);
                    } catch (err) {
                        console.log(`      - ${collection.name} (error getting count)`);
                    }
                }
            }
            console.log('-'.repeat(60));
        }
        
        // Summary
        const nonSystemDbs = databases.filter(db => 
            !db.name.startsWith('admin') && 
            !db.name.startsWith('local') && 
            !db.name.startsWith('config')
        );
        
        let totalCollections = 0;
        let totalDocuments = 0;
        
        for (const dbInfo of nonSystemDbs) {
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            totalCollections += collections.length;
            
            for (const collection of collections) {
                try {
                    const count = await db.db.collection(collection.name).countDocuments();
                    totalDocuments += count;
                } catch (err) {
                    // Skip if can't count
                }
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   Total Databases (non-system): ${nonSystemDbs.length}`);
        console.log(`   Total Collections: ${totalCollections}`);
        console.log(`   Total Documents: ${totalDocuments}`);
        
    } catch (error) {
        console.error('❌ Error listing databases:', error.message);
        console.error(error);
    }
};

const showCurrentDatabase = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
        const dbName = mongoURI.split('/').pop().split('?')[0];
        
        console.log('\n🔍 Current Connection Details:');
        console.log(`   Connection String: ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
        console.log(`   Database Name: ${dbName}`);
        console.log(`   Connected Database: ${mongoose.connection.db.databaseName}`);
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log(`\n📁 Collections in "${db.databaseName}": ${collections.length}\n`);
        
        for (const collection of collections) {
            try {
                const docCount = await db.collection(collection.name).countDocuments();
                console.log(`   📄 ${collection.name}`);
                console.log(`      Documents: ${docCount}`);
                console.log('');
            } catch (err) {
                console.log(`   📄 ${collection.name}`);
                console.log(`      Error getting stats: ${err.message}`);
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('❌ Error showing current database:', error.message);
    }
};

const main = async () => {
    const mode = process.argv[2];
    
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    if (mode === '--current' || mode === '-c') {
        await showCurrentDatabase();
    } else {
        await listAllDatabases();
        console.log('\n');
        await showCurrentDatabase();
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

