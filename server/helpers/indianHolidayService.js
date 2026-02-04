/**
 * Indian Holiday Service
 * Provides Indian holidays with themes and auto-detection
 */

import logger from './logger.js';

/**
 * Get Indian holidays for a specific year
 * Includes major national and religious festivals
 */
export const getIndianHolidays = (year) => {
    const holidays = [];

    // Fixed date holidays
    const fixedHolidays = [
        { name: 'Republic Day', date: `${year}-01-26`, type: 'national', theme: 'saffron', icon: '🇮🇳', color: '#FF9933' },
        { name: 'Independence Day', date: `${year}-08-15`, type: 'national', theme: 'saffron', icon: '🇮🇳', color: '#FF9933' },
        { name: 'Gandhi Jayanti', date: `${year}-10-02`, type: 'national', theme: 'saffron', icon: '🕊️', color: '#FF9933' },
        { name: 'New Year\'s Day', date: `${year}-01-01`, type: 'national', theme: 'gold', icon: '🎉', color: '#FFD700' },
        { name: 'Christmas', date: `${year}-12-25`, type: 'religious', theme: 'red', icon: '🎄', color: '#DC143C' },
        { name: 'New Year\'s Eve', date: `${year}-12-31`, type: 'national', theme: 'gold', icon: '🎊', color: '#FFD700' },
    ];

    holidays.push(...fixedHolidays);

    // Calculate variable date holidays (using approximate dates - actual dates vary by lunar calendar)
    const variableHolidays = calculateVariableIndianHolidays(year);
    holidays.push(...variableHolidays);

    return holidays;
};

/**
 * Calculate variable date Indian holidays
 * These are based on lunar calendar and vary each year
 * Using approximate dates for common years
 */
const calculateVariableIndianHolidays = (year) => {
    const holidays = [];

    // Holi (usually in March)
    const holiDate = calculateHoli(year);
    holidays.push({
        name: 'Holi',
        date: holiDate,
        type: 'religious',
        theme: 'pink',
        icon: '🎨',
        color: '#FF69B4',
        description: 'Festival of Colors'
    });

    // Diwali (usually in October/November)
    const diwaliDate = calculateDiwali(year);
    holidays.push({
        name: 'Diwali',
        date: diwaliDate,
        type: 'religious',
        theme: 'gold',
        icon: '🪔',
        color: '#FFD700',
        description: 'Festival of Lights'
    });

    // Dussehra (usually in September/October)
    const dussehraDate = calculateDussehra(year);
    holidays.push({
        name: 'Dussehra',
        date: dussehraDate,
        type: 'religious',
        theme: 'orange',
        icon: '🔥',
        color: '#FF8C00',
        description: 'Victory of Good over Evil'
    });

    // Raksha Bandhan (usually in August)
    const rakshaBandhanDate = calculateRakshaBandhan(year);
    holidays.push({
        name: 'Raksha Bandhan',
        date: rakshaBandhanDate,
        type: 'religious',
        theme: 'red',
        icon: '🎀',
        color: '#DC143C',
        description: 'Rakhi Festival'
    });

    // Eid ul-Fitr (varies - usually in April/May)
    const eidFitrDate = calculateEidFitr(year);
    holidays.push({
        name: 'Eid ul-Fitr',
        date: eidFitrDate,
        type: 'religious',
        theme: 'green',
        icon: '🌙',
        color: '#228B22',
        description: 'End of Ramadan'
    });

    // Eid ul-Adha (varies - usually in June/July)
    const eidAdhaDate = calculateEidAdha(year);
    holidays.push({
        name: 'Eid ul-Adha',
        date: eidAdhaDate,
        type: 'religious',
        theme: 'green',
        icon: '🌙',
        color: '#228B22',
        description: 'Festival of Sacrifice'
    });

    // Janmashtami (usually in August)
    const janmashtamiDate = calculateJanmashtami(year);
    holidays.push({
        name: 'Janmashtami',
        date: janmashtamiDate,
        type: 'religious',
        theme: 'blue',
        icon: '🕉️',
        color: '#4169E1',
        description: 'Krishna Janmashtami'
    });

    // Ganesh Chaturthi (usually in August/September)
    const ganeshChaturthiDate = calculateGaneshChaturthi(year);
    holidays.push({
        name: 'Ganesh Chaturthi',
        date: ganeshChaturthiDate,
        type: 'religious',
        theme: 'orange',
        icon: '🐘',
        color: '#FF8C00',
        description: 'Ganesh Festival'
    });

    // Onam (usually in August/September)
    const onamDate = calculateOnam(year);
    holidays.push({
        name: 'Onam',
        date: onamDate,
        type: 'regional',
        theme: 'green',
        icon: '🌸',
        color: '#228B22',
        description: 'Kerala Harvest Festival'
    });

    // Pongal (usually in January)
    const pongalDate = calculatePongal(year);
    holidays.push({
        name: 'Pongal',
        date: pongalDate,
        type: 'regional',
        theme: 'yellow',
        icon: '🌾',
        color: '#FFD700',
        description: 'Tamil Harvest Festival'
    });

    // Baisakhi (usually in April)
    const baisakhiDate = calculateBaisakhi(year);
    holidays.push({
        name: 'Baisakhi',
        date: baisakhiDate,
        type: 'religious',
        theme: 'yellow',
        icon: '🌾',
        color: '#FFD700',
        description: 'Sikh New Year'
    });

    // Durga Puja (usually in September/October)
    const durgaPujaDate = calculateDurgaPuja(year);
    holidays.push({
        name: 'Durga Puja',
        date: durgaPujaDate,
        type: 'religious',
        theme: 'red',
        icon: '🕉️',
        color: '#DC143C',
        description: 'Navratri Festival'
    });

    // Makar Sankranti (usually in January)
    const makarSankrantiDate = calculateMakarSankranti(year);
    holidays.push({
        name: 'Makar Sankranti',
        date: makarSankrantiDate,
        type: 'religious',
        theme: 'yellow',
        icon: '☀️',
        color: '#FFD700',
        description: 'Harvest Festival'
    });

    return holidays;
};

/**
 * Calculate Holi date (approximate - usually March 8-9)
 */
const calculateHoli = (year) => {
    // Holi is usually in March, approximate date
    const baseDate = new Date(year, 2, 8); // March 8
    return baseDate.toISOString().split('T')[0];
};

/**
 * Calculate Diwali date (approximate - usually October/November)
 */
const calculateDiwali = (year) => {
    // Diwali is usually in late October or early November
    // Using approximate dates for common years
    const diwaliDates = {
        2024: '2024-11-01',
        2025: '2025-10-21',
        2026: '2026-11-08',
        2027: '2027-10-29',
        2028: '2028-10-17',
        2029: '2029-11-05',
        2030: '2030-10-26'
    };
    
    if (diwaliDates[year]) {
        return diwaliDates[year];
    }
    
    // Fallback: approximate to November 1
    return `${year}-11-01`;
};

/**
 * Calculate Dussehra date (approximate - usually September/October)
 */
const calculateDussehra = (year) => {
    // Dussehra is usually 20 days before Diwali
    const diwaliDate = new Date(calculateDiwali(year));
    diwaliDate.setDate(diwaliDate.getDate() - 20);
    return diwaliDate.toISOString().split('T')[0];
};

/**
 * Calculate Raksha Bandhan date (approximate - usually August)
 */
const calculateRakshaBandhan = (year) => {
    // Raksha Bandhan is usually in August
    return `${year}-08-19`;
};

/**
 * Calculate Eid ul-Fitr date (approximate - varies by lunar calendar)
 */
const calculateEidFitr = (year) => {
    // Eid ul-Fitr is usually in April/May
    const eidDates = {
        2024: '2024-04-10',
        2025: '2025-03-31',
        2026: '2026-03-20',
        2027: '2027-03-10',
        2028: '2028-02-27',
        2029: '2029-02-15',
        2030: '2030-02-05'
    };
    
    if (eidDates[year]) {
        return eidDates[year];
    }
    
    return `${year}-04-10`;
};

/**
 * Calculate Eid ul-Adha date (approximate - varies by lunar calendar)
 */
const calculateEidAdha = (year) => {
    // Eid ul-Adha is usually in June/July
    const eidDates = {
        2024: '2024-06-16',
        2025: '2025-06-06',
        2026: '2026-05-27',
        2027: '2027-05-16',
        2028: '2028-05-05',
        2029: '2029-04-24',
        2030: '2030-04-14'
    };
    
    if (eidDates[year]) {
        return eidDates[year];
    }
    
    return `${year}-06-16`;
};

/**
 * Calculate Janmashtami date (approximate - usually August)
 */
const calculateJanmashtami = (year) => {
    // Janmashtami is usually in August
    return `${year}-08-26`;
};

/**
 * Calculate Ganesh Chaturthi date (approximate - usually August/September)
 */
const calculateGaneshChaturthi = (year) => {
    // Ganesh Chaturthi is usually in late August or early September
    return `${year}-09-05`;
};

/**
 * Calculate Onam date (approximate - usually August/September)
 */
const calculateOnam = (year) => {
    // Onam is usually in late August or early September
    return `${year}-09-05`;
};

/**
 * Calculate Pongal date (usually January 14-15)
 */
const calculatePongal = (year) => {
    return `${year}-01-15`;
};

/**
 * Calculate Baisakhi date (usually April 13-14)
 */
const calculateBaisakhi = (year) => {
    return `${year}-04-14`;
};

/**
 * Calculate Durga Puja date (approximate - usually September/October)
 */
const calculateDurgaPuja = (year) => {
    // Durga Puja is usually in September/October
    return `${year}-10-05`;
};

/**
 * Calculate Makar Sankranti date (usually January 14-15)
 */
const calculateMakarSankranti = (year) => {
    return `${year}-01-14`;
};

/**
 * Auto-detect theme based on holiday name and type
 */
export const detectHolidayTheme = (holidayName, holidayType) => {
    const name = holidayName.toLowerCase();
    
    // National holidays - Saffron theme
    if (name.includes('republic') || name.includes('independence') || name.includes('gandhi')) {
        return { theme: 'saffron', icon: '🇮🇳', color: '#FF9933' };
    }
    
    // Diwali and light festivals - Gold theme
    if (name.includes('diwali') || name.includes('deepavali')) {
        return { theme: 'gold', icon: '🪔', color: '#FFD700' };
    }
    
    // Holi - Pink theme
    if (name.includes('holi')) {
        return { theme: 'pink', icon: '🎨', color: '#FF69B4' };
    }
    
    // Dussehra - Orange theme
    if (name.includes('dussehra') || name.includes('dussehra')) {
        return { theme: 'orange', icon: '🔥', color: '#FF8C00' };
    }
    
    // Eid festivals - Green theme
    if (name.includes('eid')) {
        return { theme: 'green', icon: '🌙', color: '#228B22' };
    }
    
    // Krishna/Janmashtami - Blue theme
    if (name.includes('janmashtami') || name.includes('krishna')) {
        return { theme: 'blue', icon: '🕉️', color: '#4169E1' };
    }
    
    // Ganesh festivals - Orange theme
    if (name.includes('ganesh') || name.includes('ganpati')) {
        return { theme: 'orange', icon: '🐘', color: '#FF8C00' };
    }
    
    // Harvest festivals - Yellow theme
    if (name.includes('pongal') || name.includes('baisakhi') || name.includes('sankranti') || name.includes('onam')) {
        return { theme: 'yellow', icon: '🌾', color: '#FFD700' };
    }
    
    // Durga Puja - Red theme
    if (name.includes('durga') || name.includes('navratri')) {
        return { theme: 'red', icon: '🕉️', color: '#DC143C' };
    }
    
    // Christmas - Red theme
    if (name.includes('christmas')) {
        return { theme: 'red', icon: '🎄', color: '#DC143C' };
    }
    
    // New Year - Gold theme
    if (name.includes('new year')) {
        return { theme: 'gold', icon: '🎉', color: '#FFD700' };
    }
    
    // Default based on type
    switch (holidayType) {
        case 'national':
            return { theme: 'saffron', icon: '🇮🇳', color: '#FF9933' };
        case 'religious':
            return { theme: 'purple', icon: '🕉️', color: '#9370DB' };
        case 'company':
            return { theme: 'blue', icon: '🏢', color: '#4169E1' };
        case 'regional':
            return { theme: 'green', icon: '📍', color: '#228B22' };
        default:
            return { theme: 'default', icon: '📅', color: '#808080' };
    }
};

/**
 * Check if a holiday name matches Indian holiday patterns
 */
export const isIndianHoliday = (holidayName) => {
    const name = holidayName.toLowerCase();
    const indianHolidayKeywords = [
        'diwali', 'holi', 'dussehra', 'eid', 'rakhi', 'raksha bandhan',
        'janmashtami', 'ganesh', 'ganpati', 'pongal', 'baisakhi', 'onam',
        'durga', 'navratri', 'sankranti', 'republic day', 'independence day',
        'gandhi jayanti', 'makar sankranti', 'durga puja', 'ramzan', 'ramadan'
    ];
    
    return indianHolidayKeywords.some(keyword => name.includes(keyword));
};

/**
 * Import Indian holidays to calendar
 */
export const importIndianHolidays = async (calendar, year, organizationId) => {
    try {
        const indianHolidays = getIndianHolidays(year);
        const newHolidays = [];
        const duplicateHolidays = [];

        for (const holidayData of indianHolidays) {
            try {
                const holidayDate = new Date(holidayData.date);
                if (isNaN(holidayDate.getTime())) {
                    continue;
                }

                // Check if holiday already exists
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
                    continue;
                }

                // Create holiday with theme
                const holiday = {
                    name: holidayData.name,
                    date: holidayDate,
                    type: holidayData.type || 'national',
                    description: holidayData.description || `Indian ${holidayData.type || 'national'} holiday`,
                    theme: holidayData.theme || 'default',
                    icon: holidayData.icon || '📅',
                    color: holidayData.color || '#808080',
                    isRecurring: true,
                    recurringPattern: 'yearly',
                    isActive: true
                };

                calendar.holidays.push(holiday);
                newHolidays.push(holiday);
            } catch (error) {
                logger.error('Error processing Indian holiday', {
                    error: error.message,
                    holidayData
                });
            }
        }

        await calendar.save();

        return {
            imported: newHolidays.length,
            duplicates: duplicateHolidays.length,
            holidays: newHolidays
        };
    } catch (error) {
        logger.error('Error importing Indian holidays', {
            error: error.message,
            stack: error.stack,
            year
        });
        throw error;
    }
};

export default {
    getIndianHolidays,
    detectHolidayTheme,
    isIndianHoliday,
    importIndianHolidays
};

