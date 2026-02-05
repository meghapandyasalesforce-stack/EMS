#!/usr/bin/env node

/**
 * Google Maps API Key Validation Script
 * Tests API key configuration and functionality
 * 
 * Usage: node server/scripts/test-google-maps-api.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (look for .env in server directory)
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({});

// Logging functions using logger utility
function logSuccess(message) {
    logger.info(`✅ ${message}`);
}

function logError(message) {
    logger.error(`❌ ${message}`);
}

function logWarning(message) {
    logger.warn(`⚠️  ${message}`);
}

function logInfo(message) {
    logger.info(`ℹ️  ${message}`);
}

function logHeader(message) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(message);
    logger.info('='.repeat(60));
}

async function testApiKeyConfiguration() {
    logHeader('Step 1: Checking API Key Configuration');
    
    const backendKey = process.env.GOOGLE_MAPS_API_KEY;
    const frontendKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!backendKey && !frontendKey) {
        logError('No API keys found in environment variables');
        logInfo('Expected: GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY');
        logInfo('Check your .env file in the server directory');
        return false;
    }
    
    const apiKey = backendKey || frontendKey;
    
    if (backendKey) {
        logSuccess('Backend API key found (GOOGLE_MAPS_API_KEY)');
    } else {
        logWarning('Backend API key not found, using frontend key');
    }
    
    if (frontendKey) {
        logSuccess('Frontend API key found (VITE_GOOGLE_MAPS_API_KEY)');
    } else {
        logWarning('Frontend API key not found');
    }
    
    logInfo(`API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
    
    return apiKey;
}

async function testGeocodingApi(apiKey) {
    logHeader('Step 2: Testing Geocoding API');
    
    try {
        logInfo('Testing geocoding: "New York, NY"');
        
        const response = await client.geocode({
            params: {
                address: 'New York, NY',
                key: apiKey,
            },
            timeout: 5000,
        });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            logSuccess('Geocoding API is working!');
            logInfo(`Address: ${result.formatted_address}`);
            logInfo(`Coordinates: ${result.geometry.location.lat}, ${result.geometry.location.lng}`);
            return true;
        } else {
            logError('Geocoding API returned no results');
            return false;
        }
    } catch (error) {
        logError(`Geocoding API test failed: ${error.message}`);
        
        if (error.response?.data?.error_message) {
            logError(`API Error: ${error.response.data.error_message}`);
        }
        
        // Common error messages
        if (error.message.includes('API key')) {
            logWarning('Check if API key is correct and APIs are enabled');
        }
        if (error.message.includes('billing')) {
            logWarning('Billing may not be enabled. Enable billing in Google Cloud Console');
        }
        if (error.message.includes('referer')) {
            logWarning('API key restrictions may be blocking the request');
        }
        
        return false;
    }
}

async function testReverseGeocodingApi(apiKey) {
    logHeader('Step 3: Testing Reverse Geocoding API');
    
    try {
        logInfo('Testing reverse geocoding: Coordinates (40.7128, -74.0060)');
        
        const response = await client.reverseGeocode({
            params: {
                latlng: { lat: 40.7128, lng: -74.0060 },
                key: apiKey,
            },
            timeout: 5000,
        });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            logSuccess('Reverse Geocoding API is working!');
            logInfo(`Address: ${result.formatted_address}`);
            return true;
        } else {
            logError('Reverse Geocoding API returned no results');
            return false;
        }
    } catch (error) {
        logError(`Reverse Geocoding API test failed: ${error.message}`);
        
        if (error.response?.data?.error_message) {
            logError(`API Error: ${error.response.data.error_message}`);
        }
        
        return false;
    }
}

async function checkApiStatus(apiKey) {
    logHeader('Step 4: Checking API Status');
    
    // Note: There's no direct API to check enabled APIs, but we can infer from errors
    logInfo('Checking API availability...');
    
    const apisToCheck = [
        { name: 'Maps JavaScript API', endpoint: 'maps' },
        { name: 'Geocoding API', endpoint: 'geocoding' },
        { name: 'Places API', endpoint: 'places' },
    ];
    
    logInfo('To verify APIs are enabled:');
    logInfo('1. Go to Google Cloud Console → APIs & Services → Dashboard');
    logInfo('2. Check that these APIs show as "Enabled":');
    apisToCheck.forEach(api => {
        logInfo(`   - ${api.name}`);
    });
}

function displayNextSteps() {
    logHeader('Next Steps');
    
    logInfo('1. If all tests passed, your API key is configured correctly!');
    logInfo('2. Add the API key to your frontend .env.local file:');
    logInfo('   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here');
    logInfo('3. Restart your development server');
    logInfo('4. Test the map features in your application');
    logWarning('5. Set up billing alerts in Google Cloud Console');
    logWarning('6. Monitor usage regularly');
}

function displayTroubleshootingTips() {
    logHeader('Troubleshooting Tips');
    
    logWarning('If tests failed:');
    logInfo('1. Verify API key is correct');
    logInfo('2. Check APIs are enabled in Google Cloud Console');
    logInfo('3. Ensure billing is enabled (required even for free tier)');
    logInfo('4. Check API key restrictions (HTTP referrers, API restrictions)');
    logInfo('5. Review error messages above for specific issues');
    logInfo('\nFor detailed setup instructions, see: GOOGLE_MAPS_SETUP.md');
}

async function main() {
    logHeader('Google Maps API Key Validation');
    logInfo('Testing your Google Maps API configuration...\n');
    
    // Step 1: Check API key configuration
    const apiKey = await testApiKeyConfiguration();
    if (!apiKey) {
        displayTroubleshootingTips();
        process.exit(1);
    }
    
    // Step 2: Test Geocoding API
    const geocodingWorks = await testGeocodingApi(apiKey);
    
    // Step 3: Test Reverse Geocoding API
    const reverseGeocodingWorks = await testReverseGeocodingApi(apiKey);
    
    // Step 4: Check API Status
    await checkApiStatus(apiKey);
    
    // Summary
    logHeader('Test Summary');
    
    if (geocodingWorks && reverseGeocodingWorks) {
        logSuccess('All API tests passed!');
        logSuccess('Your Google Maps API is configured correctly.');
        displayNextSteps();
        process.exit(0);
    } else {
        logError('Some API tests failed.');
        logWarning('Please review the errors above and fix the issues.');
        displayTroubleshootingTips();
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    logger.error('Unexpected error details:', { error: error.message, stack: error.stack });
    process.exit(1);
});

