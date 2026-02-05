/**
 * Test script to directly test the login endpoint
 * Usage: node server/scripts/testLoginEndpoint.js <email> <password>
 */

import logger from '../helpers/logger.js';

const testLogin = async (email, password) => {
    if (!email || !password) {
        logger.error('❌ Please provide both email and password');
        logger.info('Usage: node server/scripts/testLoginEndpoint.js <email> <password>');
        process.exit(1);
    }

    logger.info(`\n🔍 Testing login endpoint for: ${email}\n`);

    const baseURL = 'http://localhost:10000/api';
    
    // Test admin login
    logger.info('Testing Admin Login...');
    try {
        const adminResponse = await fetch(
            `${baseURL}/v1/admin/auth/login`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            }
        );
        
        const adminData = await adminResponse.json();
        logger.info(`Status: ${adminResponse.status}`);
        logger.info('Response:', { response: adminData });
        
        if (adminResponse.status === 200) {
            logger.info('✅ Admin login successful!');
            return;
        } else {
            logger.info(`❌ Admin login failed: ${adminData?.message || 'Unknown error'}`);
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            logger.error('❌ Cannot connect to server. Is the server running on port 10000?');
            logger.error('   Start the server with: cd server && npm run dev');
            process.exit(1);
        } else {
            logger.error('❌ Error:', { error: error.message });
        }
    }

    // Test employee login
    logger.info('\nTesting Employee Login...');
    try {
        const employeeResponse = await fetch(
            `${baseURL}/v1/employee/auth/login`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            }
        );
        
        const employeeData = await employeeResponse.json();
        logger.info(`Status: ${employeeResponse.status}`);
        logger.info('Response:', { response: employeeData });
        
        if (employeeResponse.status === 200) {
            logger.info('✅ Employee login successful!');
        } else {
            logger.info(`❌ Employee login failed: ${employeeData?.message || 'Unknown error'}`);
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            logger.error('❌ Cannot connect to server. Is the server running on port 10000?');
            logger.error('   Start the server with: cd server && npm run dev');
        } else {
            logger.error('❌ Error:', { error: error.message });
        }
    }
};

const main = async () => {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        logger.error('❌ Missing required parameters');
        logger.info('Usage: node server/scripts/testLoginEndpoint.js <email> <password>');
        process.exit(1);
    }

    await testLogin(email, password);
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    if (error.code === 'ECONNREFUSED') {
        logger.error('\n💡 Make sure the server is running:');
        logger.error('   cd server && npm run dev');
    }
    process.exit(1);
});

