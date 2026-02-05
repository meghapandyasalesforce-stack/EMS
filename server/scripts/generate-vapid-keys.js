#!/usr/bin/env node

/**
 * VAPID Keys Generator Script
 * Generates VAPID keys for Web Push Notifications
 * 
 * Usage: node scripts/generate-vapid-keys.js
 */

import webpush from 'web-push';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envExamplePath = join(rootDir, 'env.example');
const envPath = join(rootDir, '.env');

logger.info('==========================================');
logger.info('VAPID Keys Generator for EMS-Paarsiv');
logger.info('==========================================');
logger.info('');

// Generate VAPID keys
logger.info('Generating VAPID keys...');
const vapidKeys = webpush.generateVAPIDKeys();

logger.info('');
logger.info('✅ VAPID keys generated successfully!');
logger.info('');
logger.info('Public Key:');
logger.info(vapidKeys.publicKey);
logger.info('');
logger.info('Private Key:');
logger.info(vapidKeys.privateKey);
logger.info('');

// Ask for subject
const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Enter VAPID subject (mailto:email@example.com or https://yourdomain.com): ', (subject) => {
    if (!subject) {
        subject = 'mailto:admin@example.com';
        logger.info(`Using default subject: ${subject}`);
    }

    logger.info('');
    logger.info('==========================================');
    logger.info('Add these to your .env file:');
    logger.info('==========================================');
    logger.info('');
    logger.info(`VAPID_SUBJECT=${subject}`);
    logger.info(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    logger.info(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    logger.info('');

    // Try to update .env file if it exists
    if (existsSync(envPath)) {
        readline.question('Update .env file automatically? (y/n): ', (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                try {
                    let envContent = readFileSync(envPath, 'utf8');
                    
                    // Update or add VAPID_SUBJECT
                    if (envContent.includes('VAPID_SUBJECT=')) {
                        envContent = envContent.replace(/VAPID_SUBJECT=.*/g, `VAPID_SUBJECT=${subject}`);
                    } else {
                        envContent += `\nVAPID_SUBJECT=${subject}\n`;
                    }
                    
                    // Update or add VAPID_PUBLIC_KEY
                    if (envContent.includes('VAPID_PUBLIC_KEY=')) {
                        envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*/g, `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
                    } else {
                        envContent += `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`;
                    }
                    
                    // Update or add VAPID_PRIVATE_KEY
                    if (envContent.includes('VAPID_PRIVATE_KEY=')) {
                        envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*/g, `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
                    } else {
                        envContent += `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`;
                    }
                    
                    writeFileSync(envPath, envContent);
                    logger.info('✅ .env file updated successfully!');
                } catch (error) {
                    logger.error('❌ Error updating .env file:', { error: error.message });
                    logger.info('Please update .env file manually with the keys above.');
                }
            } else {
                logger.info('Please update .env file manually with the keys above.');
            }
            
            readline.close();
        });
    } else {
        logger.warn('⚠️  .env file not found. Please create it and add the keys above.');
        readline.close();
    }
});

