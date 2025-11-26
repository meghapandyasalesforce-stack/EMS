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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envExamplePath = join(rootDir, 'env.example');
const envPath = join(rootDir, '.env');

console.log('==========================================');
console.log('VAPID Keys Generator for EMS-Paarsiv');
console.log('==========================================');
console.log('');

// Generate VAPID keys
console.log('Generating VAPID keys...');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('');
console.log('✅ VAPID keys generated successfully!');
console.log('');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key:');
console.log(vapidKeys.privateKey);
console.log('');

// Ask for subject
const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Enter VAPID subject (mailto:email@example.com or https://yourdomain.com): ', (subject) => {
    if (!subject) {
        subject = 'mailto:admin@example.com';
        console.log(`Using default subject: ${subject}`);
    }

    console.log('');
    console.log('==========================================');
    console.log('Add these to your .env file:');
    console.log('==========================================');
    console.log('');
    console.log(`VAPID_SUBJECT=${subject}`);
    console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    console.log('');

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
                    console.log('✅ .env file updated successfully!');
                } catch (error) {
                    console.log('❌ Error updating .env file:', error.message);
                    console.log('Please update .env file manually with the keys above.');
                }
            } else {
                console.log('Please update .env file manually with the keys above.');
            }
            
            readline.close();
        });
    } else {
        console.log('⚠️  .env file not found. Please create it and add the keys above.');
        readline.close();
    }
});

