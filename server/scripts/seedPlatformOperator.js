/**
 * Seed a SaaS platform operator account for the control panel.
 *
 * Usage:
 *   node server/scripts/seedPlatformOperator.js <email> <password> [name]
 *
 * Example:
 *   node server/scripts/seedPlatformOperator.js ops@paarsiv.com SecurePass123 "Platform Ops"
 *
 * Env fallbacks: PLATFORM_OPERATOR_EMAIL, PLATFORM_OPERATOR_PASSWORD, PLATFORM_OPERATOR_NAME
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';
import { SAAS_OPERATOR_ROLES } from '../config/identity.constants.js';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    await mongoose.connect(mongoURI);
};

const seed = async () => {
    const emailArg = process.argv[2];
    const passwordArg = process.argv[3];
    const nameArg = process.argv[4];

    const email = (emailArg || process.env.PLATFORM_OPERATOR_EMAIL || '').toLowerCase().trim();
    const password = passwordArg || process.env.PLATFORM_OPERATOR_PASSWORD || '';
    const name = nameArg || process.env.PLATFORM_OPERATOR_NAME || 'Platform Operator';

    if (!email || !password) {
        logger.error('Missing email/password');
        logger.info('Usage: node server/scripts/seedPlatformOperator.js <email> <password> [name]');
        process.exit(1);
    }

    if (password.length < 8) {
        logger.error('Password must be at least 8 characters');
        process.exit(1);
    }

    await connectDB();

    let user = await User.findOne({ email, role: 'platform' });
    if (!user) {
        user = await User.findOne({ email, roles: SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR });
    }

    if (user) {
        user.role = 'platform';
        user.roles = [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR];
        user.organizationId = null;
        user.isActive = true;
        user.password = password;
        user.name = name;
        await user.save();
        logger.info('Updated existing platform operator', { id: user._id, email: user.email });
    } else {
        user = new User({
            name,
            email,
            password,
            role: 'platform',
            roles: [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR],
            organizationId: null,
            isActive: true,
            emailVerified: true,
        });
        await user.save();
        logger.info('Created platform operator', { id: user._id, email: user.email });
    }

    logger.info('Login at /platform/login with this account');
    await mongoose.disconnect();
};

seed().catch(async (error) => {
    logger.error('seedPlatformOperator failed', { error: error.message });
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
