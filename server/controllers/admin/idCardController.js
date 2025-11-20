import IdCard from '../../models/idCard.model.js';
import Employee from '../../models/employee.model.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import logger from '../../helpers/logger.js';

// Helper to generate QR code image and save it
const generateAndSaveQRCode = async (data, employeeCode) => {
    try {
        logger.info('Generating QR code', { employeeCode });
        const qrCodeFileName = `qr-${employeeCode}-${Date.now()}.png`;
        const qrCodePath = path.join(process.cwd(), 'public', 'uploads', 'qrcodes', qrCodeFileName);
        const qrCodeUrl = `/uploads/qrcodes/${qrCodeFileName}`;

        // Ensure directory exists
        const qrCodeDir = path.join(process.cwd(), 'public', 'uploads', 'qrcodes');
        if (!fs.existsSync(qrCodeDir)) {
            logger.info('Creating qrcodes directory', { qrCodeDir });
            fs.mkdirSync(qrCodeDir, { recursive: true });
        }

        logger.info('Saving QR code', { qrCodePath });
        await QRCode.toFile(qrCodePath, data, {
            errorCorrectionLevel: 'H',
            width: 200,
            margin: 2
        });
        
        logger.info('QR code saved successfully', { qrCodeUrl });
        return { qrCodePath, qrCodeUrl, qrCodeFileName };
    } catch (error) {
        logger.error('QR Code generation error', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            path: error.path,
            employeeCode
        });
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
};

// Generate ID Card
export const generateIdCard = async (req, res) => {
    try {
        logger.info('ID card generation request', {
            employeeId: req.body.employeeId,
            adminId: req.user._id,
            path: req.path
        });
        const { 
            employeeId, 
            cardDesign = {},
            cardType = 'employee',
            accessLevel = 'basic',
            accessZones = []
        } = req.body;
        const adminId = req.user._id;

        logger.debug('Looking for employee', { employeeId, employeeIdType: typeof employeeId });
        
        // Check if employeeId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            logger.warn('Invalid employee ID format', { employeeId });
            return res.status(400).json({ message: 'Invalid employee ID format' });
        }
        
        const employee = await Employee.findById(employeeId).select('name lastName employeeId jobTitle department email joiningDate profilePhoto position jobCategory phone1 phone2 address bloodGroup');
        if (!employee) {
            logger.warn('Employee not found', { employeeId });
            return res.status(404).json({ message: 'Employee not found' });
        }

        logger.info('Found employee', { employeeId: employee._id, name: employee.name });

        // Check if an ID card already exists for this employee
        const existingIdCard = await IdCard.findOne({ employeeId });
        if (existingIdCard) {
            logger.warn('ID card already exists for employee', { employeeId });
            return res.status(400).json({ message: 'ID card already exists for this employee. Please update it instead.' });
        }

        // Data to encode in QR code
        const qrData = JSON.stringify({
            employeeId: employee.employeeId,
            email: employee.email,
            name: `${employee.name} ${employee.lastName}`,
            department: employee.department,
            jobTitle: employee.jobTitle
        });

        logger.debug('Generating QR code', { employeeId: employee.employeeId });
        let qrCodeUrl, qrCodeFileName;
        try {
            const qrResult = await generateAndSaveQRCode(qrData, employee.employeeId);
            qrCodeUrl = qrResult.qrCodeUrl;
            qrCodeFileName = qrResult.qrCodeFileName;
            logger.info('QR code generated successfully', { qrCodeUrl, employeeId: employee.employeeId });
        } catch (qrError) {
            logger.error('QR Code generation failed', {
                error: qrError.message,
                stack: qrError.stack,
                employeeId: employee.employeeId
            });
            // Continue without QR code if it fails
            qrCodeUrl = null;
            qrCodeFileName = null;
        }

        // Default card design if not provided - merge carefully to avoid undefined values
        const defaultCardDesign = {
            template: cardDesign?.template || 'standard',
            backgroundColor: cardDesign?.backgroundColor || '#ffffff',
            textColor: cardDesign?.textColor || '#000000',
            companyName: cardDesign?.companyName || 'Paarsiv Technologies',
            companyAddress: cardDesign?.companyAddress || 'Your Company Address'
        };

        // Generate card number
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(100000 + Math.random() * 900000);
        const cardNumber = `ID${year}${random}`;

        logger.debug('Creating ID card', { cardDesign: defaultCardDesign.template, employeeId: employee._id });
        const idCardData = {
            employeeId: employee._id,
            cardNumber: cardNumber, // Add cardNumber explicitly
            cardType,
            cardDesign: defaultCardDesign,
            accessLevel,
            accessZones,
            generatedBy: adminId
        };

        // Only add QR code if it was generated successfully
        if (qrCodeUrl) {
            idCardData.qrCode = {
                data: qrData,
                imageUrl: qrCodeUrl
            };
        }

        const newIdCard = await IdCard.create(idCardData);

        logger.info('ID card created successfully', { idCardId: newIdCard._id, employeeId: employee._id });
        res.status(201).json({ 
            message: 'ID card generated successfully', 
            idCard: newIdCard,
            qrCodeUrl: qrCodeUrl || null
        });

    } catch (error) {
        logger.error('Generate ID Card Error', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            employeeId: req.body.employeeId
        });
        res.status(500).json({ message: 'Failed to generate ID card', error: error.message });
    }
};

// Get all ID Cards
export const getAllIdCards = async (req, res) => {
    try {
        const idCards = await IdCard.find().populate('employeeId', 'name lastName email employeeId');
        res.status(200).json({ success: true, data: idCards });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve ID cards', error: error.message });
    }
};

// Get ID Card by Employee ID
export const getIdCardByEmployeeId = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const idCard = await IdCard.findOne({ employeeId }).populate('employeeId', 'name lastName email employeeId');
        if (!idCard) {
            return res.status(404).json({ message: 'ID card not found for this employee' });
        }
        res.status(200).json({ idCard });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve ID card', error: error.message });
    }
};

// Update ID Card (e.g., expiry date, status)
export const updateIdCard = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedBy = req.user._id;

        const updatedIdCard = await IdCard.findByIdAndUpdate(
            id,
            { ...updates, updatedBy },
            { new: true, runValidators: true }
        );

        if (!updatedIdCard) {
            return res.status(404).json({ message: 'ID card not found' });
        }
        res.status(200).json({ message: 'ID card updated successfully', idCard: updatedIdCard });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update ID card', error: error.message });
    }
};

// Revoke ID Card
export const revokeIdCard = async (req, res) => {
    try {
        const { id } = req.params;
        const revokedIdCard = await IdCard.findByIdAndUpdate(
            id,
            { status: 'cancelled' },
            { new: true }
        );

        if (!revokedIdCard) {
            return res.status(404).json({ message: 'ID card not found' });
        }
        res.status(200).json({ message: 'ID card cancelled successfully', idCard: revokedIdCard });
    } catch (error) {
        res.status(500).json({ message: 'Failed to cancel ID card', error: error.message });
    }
};

// Get employee's own ID card
export const getEmployeeIdCard = async (req, res) => {
    try {
        // Use req.employee which is set by isAuthenticated middleware for employees
        const employeeId = req.employee?._id || req.user?._id;
        
        if (!employeeId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        
        const idCard = await IdCard.findOne({ employeeId }).populate('employeeId', 'name lastName email employeeId profilePhoto phone1 phone2 address bloodGroup jobTitle department joiningDate');
        
        if (!idCard) {
            return res.status(404).json({ message: 'ID card not found for this employee. Please contact your administrator.' });
        }
        
        res.status(200).json({ success: true, idCard });
    } catch (error) {
        logger.error('Get Employee ID Card Error', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee?._id || req.user?._id
        });
        res.status(500).json({ message: 'Failed to retrieve ID card', error: error.message });
    }
};

// Download ID Card
export const downloadIdCard = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the ID card
        const idCard = await IdCard.findById(id).populate('employeeId');
        
        if (!idCard) {
            return res.status(404).json({ message: 'ID card not found' });
        }

        // For now, return the ID card data as JSON
        // In production, you would generate an actual image/PDF here
        // You could use libraries like Puppeteer, jsPDF, or html-pdf-node
        
        res.status(200).json({
            success: true,
            message: 'ID card download (preview mode - PDF generation not yet implemented)',
            idCard: idCard
        });
    } catch (error) {
        logger.error('Download ID Card Error', {
            error: error.message,
            stack: error.stack,
            idCardId: req.params.id
        });
        res.status(500).json({ message: 'Failed to download ID card', error: error.message });
    }
};

// Test endpoint to check database connection and employees
export const testDatabaseConnection = async (req, res) => {
    try {
        logger.info('Testing database connection');
        
        // Test database connection
        const dbState = mongoose.connection.readyState;
        logger.debug('Database state', { dbState });
        
        // Count employees
        const employeeCount = await Employee.countDocuments();
        logger.debug('Employee count', { employeeCount });
        
        // Get a few sample employees
        const sampleEmployees = await Employee.find().limit(5).select('name lastName employeeId email');
        logger.debug('Sample employees retrieved', { count: sampleEmployees.length });
        
        res.status(200).json({
            message: 'Database connection test successful',
            databaseState: dbState,
            employeeCount,
            sampleEmployees
        });
    } catch (error) {
        logger.error('Database test error', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            message: 'Database test failed', 
            error: error.message 
        });
    }
};