import IdCard from '../../models/idCard.model.js';
import Employee from '../../models/employee.model.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

// Helper to generate QR code image and save it
const generateAndSaveQRCode = async (data, employeeCode) => {
    try {
        console.log('Generating QR code for:', employeeCode);
        const qrCodeFileName = `qr-${employeeCode}-${Date.now()}.png`;
        const qrCodePath = path.join(process.cwd(), 'public', 'uploads', 'qrcodes', qrCodeFileName);
        const qrCodeUrl = `/uploads/qrcodes/${qrCodeFileName}`;

        // Ensure directory exists
        const qrCodeDir = path.join(process.cwd(), 'public', 'uploads', 'qrcodes');
        if (!fs.existsSync(qrCodeDir)) {
            console.log('Creating qrcodes directory:', qrCodeDir);
            fs.mkdirSync(qrCodeDir, { recursive: true });
        }

        console.log('Saving QR code to:', qrCodePath);
        await QRCode.toFile(qrCodePath, data, {
            errorCorrectionLevel: 'H',
            width: 200,
            margin: 2
        });
        
        console.log('QR code saved successfully');
        return { qrCodePath, qrCodeUrl, qrCodeFileName };
    } catch (error) {
        console.error('QR Code generation error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            path: error.path
        });
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
};

// Generate ID Card
export const generateIdCard = async (req, res) => {
    try {
        console.log('=== ID CARD GENERATION REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Request headers:', req.headers);
        console.log('User info:', req.user);
        const { 
            employeeId, 
            expiryDate, 
            cardDesign = {},
            cardType = 'employee',
            accessLevel = 'basic',
            accessZones = []
        } = req.body;
        const adminId = req.user._id;

        console.log('Looking for employee:', employeeId);
        console.log('Employee ID type:', typeof employeeId);
        
        // Check if employeeId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            console.log('Invalid employee ID format');
            return res.status(400).json({ message: 'Invalid employee ID format' });
        }
        
        const employee = await Employee.findById(employeeId).select('name lastName employeeId jobTitle department email joiningDate profilePhoto position jobCategory phone1 phone2 address bloodGroup');
        if (!employee) {
            console.log('Employee not found for ID:', employeeId);
            return res.status(404).json({ message: 'Employee not found' });
        }

        console.log('Found employee:', employee.name);

        // Check if an ID card already exists for this employee
        const existingIdCard = await IdCard.findOne({ employeeId });
        if (existingIdCard) {
            console.log('ID card already exists for employee');
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

        console.log('Generating QR code...');
        let qrCodeUrl, qrCodeFileName;
        try {
            const qrResult = await generateAndSaveQRCode(qrData, employee.employeeId);
            qrCodeUrl = qrResult.qrCodeUrl;
            qrCodeFileName = qrResult.qrCodeFileName;
            console.log('QR code generated:', qrCodeUrl);
        } catch (qrError) {
            console.error('QR Code generation failed:', qrError);
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

        console.log('Creating ID card with design:', defaultCardDesign);
        const idCardData = {
            employeeId: employee._id,
            cardNumber: cardNumber, // Add cardNumber explicitly
            expiryDate: new Date(expiryDate),
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

        console.log('ID card created successfully:', newIdCard._id);
        res.status(201).json({ 
            message: 'ID card generated successfully', 
            idCard: newIdCard,
            qrCodeUrl: qrCodeUrl || null
        });

    } catch (error) {
        console.error('Generate ID Card Error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
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
        console.error('Get Employee ID Card Error:', error);
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
        console.error('Download ID Card Error:', error);
        res.status(500).json({ message: 'Failed to download ID card', error: error.message });
    }
};

// Test endpoint to check database connection and employees
export const testDatabaseConnection = async (req, res) => {
    try {
        console.log('Testing database connection...');
        
        // Test database connection
        const dbState = mongoose.connection.readyState;
        console.log('Database state:', dbState);
        
        // Count employees
        const employeeCount = await Employee.countDocuments();
        console.log('Employee count:', employeeCount);
        
        // Get a few sample employees
        const sampleEmployees = await Employee.find().limit(5).select('name lastName employeeId email');
        console.log('Sample employees:', sampleEmployees);
        
        res.status(200).json({
            message: 'Database connection test successful',
            databaseState: dbState,
            employeeCount,
            sampleEmployees
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ 
            message: 'Database test failed', 
            error: error.message 
        });
    }
};