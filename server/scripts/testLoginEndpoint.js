/**
 * Test script to directly test the login endpoint
 * Usage: node server/scripts/testLoginEndpoint.js <email> <password>
 */

const testLogin = async (email, password) => {
    if (!email || !password) {
        console.error('❌ Please provide both email and password');
        console.log('Usage: node server/scripts/testLoginEndpoint.js <email> <password>');
        process.exit(1);
    }

    console.log(`\n🔍 Testing login endpoint for: ${email}\n`);

    const baseURL = 'http://localhost:10000/api';
    
    // Test admin login
    console.log('Testing Admin Login...');
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
        console.log(`Status: ${adminResponse.status}`);
        console.log('Response:', JSON.stringify(adminData, null, 2));
        
        if (adminResponse.status === 200) {
            console.log('✅ Admin login successful!');
            return;
        } else {
            console.log(`❌ Admin login failed: ${adminData?.message || 'Unknown error'}`);
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            console.error('❌ Cannot connect to server. Is the server running on port 10000?');
            console.error('   Start the server with: cd server && npm run dev');
            process.exit(1);
        } else {
            console.error('❌ Error:', error.message);
        }
    }

    // Test employee login
    console.log('\nTesting Employee Login...');
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
        console.log(`Status: ${employeeResponse.status}`);
        console.log('Response:', JSON.stringify(employeeData, null, 2));
        
        if (employeeResponse.status === 200) {
            console.log('✅ Employee login successful!');
        } else {
            console.log(`❌ Employee login failed: ${employeeData?.message || 'Unknown error'}`);
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            console.error('❌ Cannot connect to server. Is the server running on port 10000?');
            console.error('   Start the server with: cd server && npm run dev');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
};

const main = async () => {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error('❌ Missing required parameters');
        console.log('Usage: node server/scripts/testLoginEndpoint.js <email> <password>');
        process.exit(1);
    }

    await testLogin(email, password);
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error.message);
    if (error.code === 'ECONNREFUSED') {
        console.error('\n💡 Make sure the server is running:');
        console.error('   cd server && npm run dev');
    }
    process.exit(1);
});

