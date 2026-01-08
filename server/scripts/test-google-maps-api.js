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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (look for .env in server directory)
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({});

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'cyan');
}

function logHeader(message) {
    log(`\n${'='.repeat(60)}`, 'blue');
    log(message, 'blue');
    log('='.repeat(60), 'blue');
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
    
    log('1. If all tests passed, your API key is configured correctly!', 'green');
    log('2. Add the API key to your frontend .env.local file:', 'cyan');
    log('   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here', 'cyan');
    log('3. Restart your development server', 'cyan');
    log('4. Test the map features in your application', 'cyan');
    log('5. Set up billing alerts in Google Cloud Console', 'yellow');
    log('6. Monitor usage regularly', 'yellow');
}

function displayTroubleshootingTips() {
    logHeader('Troubleshooting Tips');
    
    log('If tests failed:', 'yellow');
    log('1. Verify API key is correct', 'cyan');
    log('2. Check APIs are enabled in Google Cloud Console', 'cyan');
    log('3. Ensure billing is enabled (required even for free tier)', 'cyan');
    log('4. Check API key restrictions (HTTP referrers, API restrictions)', 'cyan');
    log('5. Review error messages above for specific issues', 'cyan');
    log('\nFor detailed setup instructions, see: GOOGLE_MAPS_SETUP.md', 'blue');
}

async function main() {
    console.clear();
    logHeader('Google Maps API Key Validation');
    log('Testing your Google Maps API configuration...\n', 'cyan');
    
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
    console.error(error);
    process.exit(1);
});

