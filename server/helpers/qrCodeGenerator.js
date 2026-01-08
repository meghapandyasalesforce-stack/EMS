/**
 * QR Code Generator Helper
 * Generates QR codes for employees, ID cards, and attendance
 */

import QRCode from 'qrcode';
import logger from './logger.js';

/**
 * Generate QR code as data URL (base64)
 * @param {string} data - Data to encode in QR code
 * @param {Object} options - QR code options
 * @returns {Promise<string>} Data URL of QR code image
 */
export const generateQRCodeDataURL = async (data, options = {}) => {
    try {
        const {
            width = 200,
            margin = 1,
            color = {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel = 'M'
        } = options;

        const qrCodeDataURL = await QRCode.toDataURL(data, {
            width,
            margin,
            color,
            errorCorrectionLevel
        });

        logger.debug('QR code generated successfully', { dataLength: data.length });
        return qrCodeDataURL;
    } catch (error) {
        logger.error('QR code generation failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Generate QR code as buffer (for saving to file)
 * @param {string} data - Data to encode in QR code
 * @param {Object} options - QR code options
 * @returns {Promise<Buffer>} Buffer containing QR code image
 */
export const generateQRCodeBuffer = async (data, options = {}) => {
    try {
        const {
            width = 200,
            margin = 1,
            color = {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel = 'M'
        } = options;

        const qrCodeBuffer = await QRCode.toBuffer(data, {
            width,
            margin,
            color,
            errorCorrectionLevel
        });

        logger.debug('QR code buffer generated successfully', { dataLength: data.length });
        return qrCodeBuffer;
    } catch (error) {
        logger.error('QR code buffer generation failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Generate employee QR code for ID card
 * @param {Object} employee - Employee object
 * @param {Object} options - QR code options
 * @returns {Promise<string>} Data URL of QR code
 */
export const generateEmployeeQRCode = async (employee, options = {}) => {
    try {
        // Create JSON data with employee info
        const qrData = {
            type: 'employee',
            employeeId: employee.employeeId || employee._id.toString(),
            name: `${employee.name} ${employee.lastName || ''}`.trim(),
            email: employee.email,
            organizationId: employee.organizationId?.toString(),
            timestamp: new Date().toISOString()
        };

        const qrCodeData = JSON.stringify(qrData);
        return await generateQRCodeDataURL(qrCodeData, {
            width: 300,
            ...options
        });
    } catch (error) {
        logger.error('Employee QR code generation failed', {
            employeeId: employee._id,
            error: error.message
        });
        throw error;
    }
};

/**
 * Generate attendance QR code
 * @param {Object} attendanceData - Attendance data
 * @param {Object} options - QR code options
 * @returns {Promise<string>} Data URL of QR code
 */
export const generateAttendanceQRCode = async (attendanceData, options = {}) => {
    try {
        const qrData = {
            type: 'attendance',
            employeeId: attendanceData.employeeId,
            date: attendanceData.date || new Date().toISOString().split('T')[0],
            action: attendanceData.action, // 'clock-in', 'clock-out', etc.
            location: attendanceData.location,
            timestamp: new Date().toISOString()
        };

        const qrCodeData = JSON.stringify(qrData);
        return await generateQRCodeDataURL(qrCodeData, {
            width: 250,
            ...options
        });
    } catch (error) {
        logger.error('Attendance QR code generation failed', {
            error: error.message
        });
        throw error;
    }
};

/**
 * Generate QR code for office location/geo-fencing
 * @param {Object} locationData - Location data
 * @param {Object} options - QR code options
 * @returns {Promise<string>} Data URL of QR code
 */
export const generateLocationQRCode = async (locationData, options = {}) => {
    try {
        const qrData = {
            type: 'location',
            locationId: locationData.locationId,
            name: locationData.name,
            coordinates: {
                lat: locationData.lat,
                lng: locationData.lng
            },
            radius: locationData.radius, // in meters
            organizationId: locationData.organizationId
        };

        const qrCodeData = JSON.stringify(qrData);
        return await generateQRCodeDataURL(qrCodeData, {
            width: 300,
            ...options
        });
    } catch (error) {
        logger.error('Location QR code generation failed', {
            error: error.message
        });
        throw error;
    }
};

export default {
    generateQRCodeDataURL,
    generateQRCodeBuffer,
    generateEmployeeQRCode,
    generateAttendanceQRCode,
    generateLocationQRCode
};

