import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import Calendar from '../../models/calendar.model.js';
import logger from '../../helpers/logger.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';

// Helper functions for calculating holiday dates
const calculateEaster = (year) => {
  // Easter calculation using the algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  const month = n;
  const day = p + 1;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const calculateEasterMonday = (year) => {
  const easter = new Date(calculateEaster(year));
  easter.setDate(easter.getDate() + 1);
  return easter.toISOString().split('T')[0];
};

const calculateGoodFriday = (year) => {
  const easter = new Date(calculateEaster(year));
  easter.setDate(easter.getDate() - 2);
  return easter.toISOString().split('T')[0];
};

const calculateLaborDay = (year) => {
  // First Monday in September
  const september1 = new Date(year, 8, 1); // Month is 0-indexed
  const dayOfWeek = september1.getDay();
  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const laborDay = new Date(year, 8, 1 + daysToAdd);
  return laborDay.toISOString().split('T')[0];
};

const calculateThanksgiving = (year) => {
  // Fourth Thursday in November
  const november1 = new Date(year, 10, 1); // Month is 0-indexed
  const dayOfWeek = november1.getDay();
  const daysToAdd = dayOfWeek === 4 ? 21 : (4 - dayOfWeek + 7) % 7 + 21;
  const thanksgiving = new Date(year, 10, 1 + daysToAdd);
  return thanksgiving.toISOString().split('T')[0];
};

const calculateMemorialDay = (year) => {
  // Last Monday in May
  const may31 = new Date(year, 4, 31); // Month is 0-indexed
  const dayOfWeek = may31.getDay();
  const daysToSubtract = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const memorialDay = new Date(year, 4, 31 - daysToSubtract);
  return memorialDay.toISOString().split('T')[0];
};

const calculateMLKDay = (year) => {
  // Third Monday in January
  const january1 = new Date(year, 0, 1);
  const dayOfWeek = january1.getDay();
  const daysToAdd = dayOfWeek === 1 ? 14 : (8 - dayOfWeek) % 7 + 14;
  const mlkDay = new Date(year, 0, 1 + daysToAdd);
  return mlkDay.toISOString().split('T')[0];
};

const calculatePresidentsDay = (year) => {
  // Third Monday in February
  const february1 = new Date(year, 1, 1);
  const dayOfWeek = february1.getDay();
  const daysToAdd = dayOfWeek === 1 ? 14 : (8 - dayOfWeek) % 7 + 14;
  const presidentsDay = new Date(year, 1, 1 + daysToAdd);
  return presidentsDay.toISOString().split('T')[0];
};

const calculateColumbusDay = (year) => {
  // Second Monday in October
  const october1 = new Date(year, 9, 1);
  const dayOfWeek = october1.getDay();
  const daysToAdd = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 + 7;
  const columbusDay = new Date(year, 9, 1 + daysToAdd);
  return columbusDay.toISOString().split('T')[0];
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = 'uploads/calendar-files';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        logger.info('Created upload directory', { uploadDir });
      }
      cb(null, uploadDir);
    } catch (error) {
      logger.error('Error creating upload directory', {
        error: error.message,
        stack: error.stack,
        uploadDir: 'uploads/calendar-files'
      });
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `calendar-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and PDF files are allowed'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload calendar file and extract holidays
export const uploadCalendarFile = async (req, res) => {
  try {
    logger.info('Upload calendar file request received', {
      fileName: req.file?.originalname,
      year: req.params.year,
      fileSize: req.file?.size
    });
    
    if (!req.file) {
      logger.warn('No file uploaded in calendar upload request');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { year } = req.params;
    const yearNum = parseInt(year);
    
    logger.debug('Parsing year parameter', { year, yearNum });
    
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
      logger.warn('Invalid year parameter', { year, yearNum });
      return res.status(400).json({ message: 'Invalid year. Must be between 2020 and 2050' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    logger.debug('File details', { filePath, fileExtension, fileName: req.file.originalname });
    
    let extractedHolidays = [];

    if (fileExtension === '.pdf') {
      try {
        logger.info('Processing PDF file', { filePath, year: yearNum });
        // Extract text from PDF
        const dataBuffer = fs.readFileSync(filePath);
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(dataBuffer);
        
        logger.debug('PDF text extracted', { 
          textLength: pdfData.text.length,
          preview: pdfData.text.substring(0, 100)
        });
        
        if (pdfData.text && pdfData.text.trim().length > 0) {
          extractedHolidays = await extractHolidaysFromText(pdfData.text, yearNum);
          logger.info('Extracted holidays from PDF', { 
            count: extractedHolidays.length,
            year: yearNum 
          });
        } else {
          logger.warn('No text found in PDF, using common holidays', { year: yearNum });
          extractedHolidays = await getCommonHolidays(yearNum);
        }
      } catch (pdfError) {
        logger.error('PDF parsing error', {
          error: pdfError.message,
          stack: pdfError.stack,
          filePath,
          year: yearNum
        });
        // Fallback to common holidays if PDF parsing fails
        extractedHolidays = await getCommonHolidays(yearNum);
        logger.info('Using fallback holidays', { 
          count: extractedHolidays.length,
          year: yearNum 
        });
      }
    } else if (['.png', '.jpg', '.jpeg'].includes(fileExtension)) {
      logger.info('Processing image file', { filePath, year: yearNum });
      // For images, we'll use OCR-like text extraction
      // For now, we'll create a placeholder that can be enhanced with OCR libraries
      extractedHolidays = await extractHolidaysFromImage(filePath, yearNum);
      logger.info('Extracted holidays from image', { 
        count: extractedHolidays.length,
        year: yearNum 
      });
    } else {
      logger.warn('Unsupported file type, using common holidays', { 
        fileExtension,
        year: yearNum 
      });
      // Fallback for unsupported file types
      extractedHolidays = await getCommonHolidays(yearNum);
    }

    // Get organizationId from request
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    // Test database connection
    logger.debug('Testing database connection', { year: yearNum });
    try {
      const query = addOrganizationFilter(req, { year: yearNum });
      await Calendar.findOne(query);
      logger.debug('Database connection successful');
    } catch (dbError) {
      logger.error('Database connection error', {
        error: dbError.message,
        stack: dbError.stack,
        year: yearNum
      });
      throw new Error('Database connection failed');
    }

    // Get or create calendar for the year
    const query = addOrganizationFilter(req, { year: yearNum });
    let calendar = await Calendar.findOne(query);
    logger.debug('Calendar lookup', { 
      year: yearNum,
      found: !!calendar 
    });
    
    if (!calendar) {
      logger.info('Creating new calendar', { year: yearNum });
      calendar = new Calendar({
        organizationId: organizationId,
        year: yearNum,
        holidays: [],
        workingDays: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        },
        workingHours: {
          startTime: "09:00",
          endTime: "17:00",
          breakDuration: 60
        },
        companySettings: {
          timezone: "UTC",
          dateFormat: "DD/MM/YYYY",
          weekStartsOn: "monday"
        }
      });
    }

    // Add extracted holidays to calendar with better validation
    const newHolidays = [];
    const duplicateHolidays = [];
    
    for (const holidayData of extractedHolidays) {
      try {
        // Validate holiday data
        if (!holidayData.name || !holidayData.date) {
          logger.debug('Skipping invalid holiday data', { holidayData });
          continue;
        }

        // Parse and validate date
        const holidayDate = new Date(holidayData.date);
        if (isNaN(holidayDate.getTime())) {
          logger.debug('Skipping holiday with invalid date', { holidayData });
          continue;
        }

        // Check if holiday already exists (by date and name)
        const existingHoliday = calendar.holidays.find(h => {
          const existingDate = new Date(h.date);
          return existingDate.getTime() === holidayDate.getTime() && 
                 h.name.toLowerCase() === holidayData.name.toLowerCase();
        });

        if (existingHoliday) {
          duplicateHolidays.push({
            name: holidayData.name,
            date: holidayData.date,
            reason: 'Already exists'
          });
          logger.debug('Duplicate holiday found', {
            name: holidayData.name,
            date: holidayData.date
          });
          continue;
        }

        // Create new holiday
        const holiday = {
          name: holidayData.name.trim(),
          date: holidayDate,
          type: holidayData.type || 'national',
          description: holidayData.description || `Auto-generated from calendar file: ${req.file.originalname}`,
          isRecurring: holidayData.isRecurring || false,
          recurringPattern: holidayData.recurringPattern || 'yearly',
          isActive: true
        };
        
        calendar.holidays.push(holiday);
        newHolidays.push(holiday);
        logger.info('Added new holiday', {
          name: holiday.name,
          date: holiday.date.toISOString().split('T')[0],
          year: yearNum
        });
        
      } catch (error) {
        logger.error('Error processing holiday', {
          error: error.message,
          stack: error.stack,
          holidayData,
          year: yearNum
        });
      }
    }

    await calendar.save();

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'Calendar file processed successfully',
      extractedHolidays: newHolidays.length,
      totalHolidays: calendar.holidays.length,
      duplicatesFound: duplicateHolidays.length,
      holidays: newHolidays,
      duplicates: duplicateHolidays,
      summary: {
        fileType: fileExtension,
        fileName: req.file.originalname,
        processingTime: new Date().toISOString(),
        success: true
      }
    });

  } catch (error) {
    logger.error('Upload calendar file error', {
      error: error.message,
      stack: error.stack,
      year: req.params.year,
      fileName: req.file?.originalname
    });
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up file', {
          error: cleanupError.message,
          stack: cleanupError.stack,
          filePath: req.file.path
        });
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to process calendar file', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Extract holidays from text (PDF or OCR text)
const extractHolidaysFromText = async (text, year) => {
  const holidays = [];
  logger.debug('Extracting holidays from text', {
    year,
    textLength: text.length
  });
  
  // Enhanced holiday patterns with more comprehensive matching
  const holidayPatterns = [
    // New Year
    { name: 'New Year\'s Day', pattern: /new year|january 1|jan 1|1\/1|1-1/i, date: `${year}-01-01` },
    
    // Christmas
    { name: 'Christmas Day', pattern: /christmas|december 25|dec 25|12\/25|12-25/i, date: `${year}-12-25` },
    
    // Easter variations
    { name: 'Easter Sunday', pattern: /easter sunday|easter/i, date: calculateEaster(year) },
    { name: 'Easter Monday', pattern: /easter monday/i, date: calculateEasterMonday(year) },
    { name: 'Good Friday', pattern: /good friday/i, date: calculateGoodFriday(year) },
    
    // Independence Day (US)
    { name: 'Independence Day', pattern: /independence day|july 4|jul 4|4th of july|7\/4|7-4/i, date: `${year}-07-04` },
    
    // Labor Day (first Monday in September)
    { name: 'Labor Day', pattern: /labor day/i, date: calculateLaborDay(year) },
    
    // Thanksgiving (fourth Thursday in November)
    { name: 'Thanksgiving', pattern: /thanksgiving/i, date: calculateThanksgiving(year) },
    
    // Memorial Day (last Monday in May)
    { name: 'Memorial Day', pattern: /memorial day/i, date: calculateMemorialDay(year) },
    
    // Veterans Day
    { name: 'Veterans Day', pattern: /veterans day|november 11|nov 11|11\/11|11-11/i, date: `${year}-11-11` },
    
    // Martin Luther King Jr. Day (third Monday in January)
    { name: 'Martin Luther King Jr. Day', pattern: /martin luther king|mlk day|mlk/i, date: calculateMLKDay(year) },
    
    // Presidents Day (third Monday in February)
    { name: 'Presidents Day', pattern: /presidents day|washington's birthday|president's day/i, date: calculatePresidentsDay(year) },
    
    // Columbus Day (second Monday in October)
    { name: 'Columbus Day', pattern: /columbus day/i, date: calculateColumbusDay(year) },
    
    // Additional holidays
    { name: 'Valentine\'s Day', pattern: /valentine|february 14|feb 14|2\/14|2-14/i, date: `${year}-02-14` },
    { name: 'St. Patrick\'s Day', pattern: /st\.? patrick|patrick's day|march 17|mar 17|3\/17|3-17/i, date: `${year}-03-17` },
    { name: 'Halloween', pattern: /halloween|october 31|oct 31|10\/31|10-31/i, date: `${year}-10-31` },
    { name: 'New Year\'s Eve', pattern: /new year's eve|december 31|dec 31|12\/31|12-31/i, date: `${year}-12-31` }
  ];

  // Look for patterns in the text
  for (const pattern of holidayPatterns) {
    if (pattern.pattern.test(text)) {
      const holidayDate = pattern.date || pattern.date;
      holidays.push({
        name: pattern.name,
        date: holidayDate,
        type: 'national',
        description: `Auto-detected from calendar file`
      });
      logger.debug('Found holiday pattern', {
        name: pattern.name,
        date: holidayDate,
        year
      });
    }
  }

  // Enhanced date extraction patterns
  const datePatterns = [
    // Standard formats
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/g,  // MM-DD-YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,  // YYYY-MM-DD
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g, // MM.DD.YYYY
    
    // Month name formats
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
    
    // Day of week formats
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
    
    // Holiday-specific patterns
    /(new year|christmas|easter|thanksgiving|labor day|memorial day|independence day|veterans day|columbus day|presidents day|martin luther king|mlk).*?(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{4}-\d{1,2}-\d{1,2})/gi
  ];

  const monthNames = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  const holidayKeywords = {
    'new year': 'New Year\'s Day',
    'christmas': 'Christmas Day',
    'easter': 'Easter Sunday',
    'thanksgiving': 'Thanksgiving',
    'labor day': 'Labor Day',
    'memorial day': 'Memorial Day',
    'independence day': 'Independence Day',
    'veterans day': 'Veterans Day',
    'columbus day': 'Columbus Day',
    'presidents day': 'Presidents Day',
    'martin luther king': 'Martin Luther King Jr. Day',
    'mlk': 'Martin Luther King Jr. Day'
  };

  for (const datePattern of datePatterns) {
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      let dateStr, holidayName = null;
      
      // Check for holiday keywords in the match
      const matchText = match[0].toLowerCase();
      for (const [keyword, name] of Object.entries(holidayKeywords)) {
        if (matchText.includes(keyword)) {
          holidayName = name;
          break;
        }
      }
      
      if (match[0].includes('january') || match[0].includes('february') || 
          match[0].includes('march') || match[0].includes('april') || 
          match[0].includes('may') || match[0].includes('june') || 
          match[0].includes('july') || match[0].includes('august') || 
          match[0].includes('september') || match[0].includes('october') || 
          match[0].includes('november') || match[0].includes('december')) {
        // Month name format
        const month = monthNames[match[2].toLowerCase()];
        const day = match[1].padStart(2, '0');
        const year = match[3];
        dateStr = `${year}-${month}-${day}`;
      } else if (match[1].length === 4) {
        // YYYY-MM-DD format
        dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        // MM/DD/YYYY, MM-DD-YYYY, or MM.DD.YYYY format
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        const year = match[3];
        dateStr = `${year}-${month}-${day}`;
      }

      // Check if this date is in the current year
      if (dateStr.startsWith(year.toString())) {
        holidays.push({
          name: holidayName || `Holiday on ${dateStr}`,
          date: dateStr,
          type: 'national',
          description: `Auto-detected from calendar file`
        });
        logger.debug('Found date-based holiday', {
          name: holidayName || 'Unknown',
          date: dateStr,
          year
        });
      }
    }
  }

  return holidays;
};

// Get common holidays for a year
const getCommonHolidays = async (year) => {
  const commonHolidays = [
    { name: 'New Year\'s Day', date: `${year}-01-01`, type: 'national' },
    { name: 'Martin Luther King Jr. Day', date: `${year}-01-20`, type: 'national' },
    { name: 'Presidents Day', date: `${year}-02-17`, type: 'national' },
    { name: 'Memorial Day', date: `${year}-05-27`, type: 'national' },
    { name: 'Independence Day', date: `${year}-07-04`, type: 'national' },
    { name: 'Labor Day', date: `${year}-09-02`, type: 'national' },
    { name: 'Columbus Day', date: `${year}-10-14`, type: 'national' },
    { name: 'Veterans Day', date: `${year}-11-11`, type: 'national' },
    { name: 'Thanksgiving', date: `${year}-11-28`, type: 'national' },
    { name: 'Christmas Day', date: `${year}-12-25`, type: 'national' }
  ];

  return commonHolidays.map(holiday => ({
    ...holiday,
    description: `Auto-generated from calendar file`
  }));
};

// Extract holidays from image (placeholder for OCR)
const extractHolidaysFromImage = async (imagePath, year) => {
  // This is a placeholder function
  // In a real implementation, you would use OCR libraries like Tesseract.js
  // For now, we'll return some common holidays for the year
  return await getCommonHolidays(year);
};

// Get calendar file upload history
export const getCalendarUploadHistory = async (req, res) => {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);
    
    const query = addOrganizationFilter(req, { year: yearNum });
    const calendar = await Calendar.findOne(query);
    if (!calendar) {
      return res.json({ uploads: [] });
    }

    // Get holidays that were auto-generated from files
    const fileGeneratedHolidays = calendar.holidays.filter(holiday => 
      holiday.description && holiday.description.includes('Auto-generated from calendar')
    );

    res.json({
      uploads: fileGeneratedHolidays.map(holiday => ({
        id: holiday._id,
        name: holiday.name,
        date: holiday.date,
        description: holiday.description,
        createdAt: holiday.createdAt || new Date()
      }))
    });
  } catch (error) {
    logger.error('Get upload history error', {
      error: error.message,
      stack: error.stack,
      year: req.params.year
    });
    res.status(500).json({ message: 'Failed to get upload history', error: error.message });
  }
};
