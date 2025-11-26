// utils/generateToken.js
import crypto from 'crypto';
import { PASSWORD_RESET_TOKEN_BYTES } from '../config/constants.js';

export const generateResetToken = () => {
  const resetToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, hashedToken };
};
