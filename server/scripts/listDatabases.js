/**
 * Utility script to list all databases and their collections
 * Usage: node server/scripts/listDatabases.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        // Connect to admin database to list all databases
        await mongoose.connect(mongoURI);
        logger.info('✅ MongoDB connected successfully\n');
        return true;
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', { error: error.message });
        return false;
    }
};

const listAllDatabases = async () => {
    try {
        const adminDb = mongoose.connection.db.admin();
        const { databases } = await adminDb.listDatabases();
        
        logger.info('📊 MongoDB Databases:\n');
        logger.info(`Total Databases: ${databases.length}\n`);
        logger.info('='.repeat(60));
        
        for (const dbInfo of databases) {
            // Skip system databases
            if (dbInfo.name.startsWith('admin') || 
                dbInfo.name.startsWith('local') || 
                dbInfo.name.startsWith('config')) {
                continue;
            }
            
            logger.info(`\n📁 Database: ${dbInfo.name}`);
            logger.info(`   Size: ${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
            logger.info(`   Empty: ${dbInfo.empty ? 'Yes' : 'No'}`);
            
            // Get collections for this database
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            
            logger.info(`   Collections: ${collections.length}`);
            
            if (collections.length > 0) {
                logger.info(`   Collection Names:`);
                for (const collection of collections) {
                    try {
                        const docCount = await db.db.collection(collection.name).countDocuments();
                        logger.info(`      - ${collection.name} (${docCount} documents)`);
                    } catch (err) {
                        logger.info(`      - ${collection.name} (error getting count)`);
                    }
                }
            }
            logger.info('-'.repeat(60));
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
        
        logger.info('\n📊 Summary:');
        logger.info(`   Total Databases (non-system): ${nonSystemDbs.length}`);
        logger.info(`   Total Collections: ${totalCollections}`);
        logger.info(`   Total Documents: ${totalDocuments}`);
        
    } catch (error) {
        logger.error('❌ Error listing databases:', { error: error.message, stack: error.stack });
    }
};

const showCurrentDatabase = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
        const dbName = mongoURI.split('/').pop().split('?')[0];
        
        logger.info('\n🔍 Current Connection Details:');
        logger.info(`   Connection String: ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
        logger.info(`   Database Name: ${dbName}`);
        logger.info(`   Connected Database: ${mongoose.connection.db.databaseName}`);
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        logger.info(`\n📁 Collections in "${db.databaseName}": ${collections.length}\n`);
        
        for (const collection of collections) {
            try {
                const docCount = await db.collection(collection.name).countDocuments();
                logger.info(`   📄 ${collection.name}`);
                logger.info(`      Documents: ${docCount}`);
                logger.info('');
            } catch (err) {
                logger.info(`   📄 ${collection.name}`);
                logger.info(`      Error getting stats: ${err.message}`);
                logger.info('');
            }
        }
        
    } catch (error) {
        logger.error('❌ Error showing current database:', { error: error.message });
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
        logger.info('\n');
        await showCurrentDatabase();
    }

    await mongoose.connection.close();
    logger.info('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    process.exit(1);
});

