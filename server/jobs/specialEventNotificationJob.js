import cron from 'node-cron';
import Calendar from '../models/calendar.model.js';
import Employee from '../models/employee.model.js';
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';
import logger from '../helpers/logger.js';

/**
 * Send holiday notification
 */
const sendHolidayNotification = async (holiday, organizationId) => {
    try {
        await notify({
            type: 'holiday',
            organizationId,
            data: { holiday },
            isBroadcast: true
        });

        logger.info('Holiday notification sent', {
            holidayName: holiday.name,
            organizationId
        });
    } catch (error) {
        logger.error('Error sending holiday notification', {
            error: error.message,
            holidayName: holiday.name,
            organizationId
        });
    }
};

/**
 * Send birthday notification
 */
const sendBirthdayNotification = async (employee, organizationId) => {
    try {
        await notify({
            type: 'birthday',
            organizationId,
            data: { employee },
            isBroadcast: true
        });

        logger.info('Birthday notification sent', {
            employeeName: `${employee.name} ${employee.lastName || ''}`,
            organizationId
        });
    } catch (error) {
        logger.error('Error sending birthday notification', {
            error: error.message,
            employeeId: employee._id,
            organizationId
        });
    }
};

/**
 * Send work anniversary notification
 */
const sendWorkAnniversaryNotification = async (employee, yearsOfService, organizationId) => {
    try {
        await notify({
            type: 'work_anniversary',
            organizationId,
            data: { employee, years: yearsOfService },
            isBroadcast: true
        });

        logger.info('Work anniversary notification sent', {
            employeeName: `${employee.name} ${employee.lastName || ''}`,
            yearsOfService,
            organizationId
        });
    } catch (error) {
        logger.error('Error sending work anniversary notification', {
            error: error.message,
            employeeId: employee._id,
            organizationId
        });
    }
};

/**
 * Check and send holiday notifications
 * Runs at 8:00 AM every day
 */
const checkHolidayNotifications = async () => {
    try {
        logger.info('Checking for holiday notifications');

        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];
        const currentYear = today.getFullYear();

        const calendars = await Calendar.find({ year: currentYear });

        for (const calendar of calendars) {
            const todayHolidays = calendar.holidays.filter((holiday) => {
                const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
                return holidayDate === todayDate && holiday.isActive !== false;
            });

            for (const holiday of todayHolidays) {
                await sendHolidayNotification(holiday, calendar.organizationId);
            }
        }
    } catch (error) {
        logger.error('Error in holiday notification check', { error: error.message });
    }
};

/**
 * Check and send birthday notifications
 * Runs at 9:45 AM every day (15 minutes before 10 AM office start)
 */
const checkBirthdayNotifications = async () => {
    try {
        logger.info('Checking for birthday notifications');

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        const birthdayEmployees = await Employee.find({
            status: 'active',
            dateOfBirth: { $exists: true, $ne: null },
            $expr: {
                $and: [
                    { $eq: [{ $month: '$dateOfBirth' }, currentMonth] },
                    { $eq: [{ $dayOfMonth: '$dateOfBirth' }, currentDay] }
                ]
            }
        });

        const employeesByOrg = new Map();
        birthdayEmployees.forEach((emp) => {
            const orgId = emp.organizationId?.toString();
            if (orgId) {
                if (!employeesByOrg.has(orgId)) {
                    employeesByOrg.set(orgId, []);
                }
                employeesByOrg.get(orgId).push(emp);
            }
        });

        for (const [orgId, employees] of employeesByOrg.entries()) {
            for (const employee of employees) {
                await sendBirthdayNotification(employee, orgId);
            }
        }

        logger.info('Birthday notifications check completed', {
            totalBirthdays: birthdayEmployees.length
        });
    } catch (error) {
        logger.error('Error in birthday notification check', { error: error.message });
    }
};

/**
 * Check and send work anniversary notifications
 * Runs at 9:45 AM every day (15 minutes before 10 AM office start)
 */
const checkWorkAnniversaryNotifications = async () => {
    try {
        logger.info('Checking for work anniversary notifications');

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        const currentYear = today.getFullYear();

        const employees = await Employee.find({
            status: 'active',
            joiningDate: { $exists: true, $ne: null }
        });

        const anniversaryEmployees = employees.filter((emp) => {
            const joiningDate = new Date(emp.joiningDate);
            const joiningMonth = joiningDate.getMonth() + 1;
            const joiningDay = joiningDate.getDate();
            const joiningYear = joiningDate.getFullYear();

            return joiningMonth === currentMonth &&
                joiningDay === currentDay &&
                joiningYear < currentYear;
        });

        const employeesByOrg = new Map();
        anniversaryEmployees.forEach((emp) => {
            const orgId = emp.organizationId?.toString();
            if (orgId) {
                const joiningDate = new Date(emp.joiningDate);
                const yearsOfService = currentYear - joiningDate.getFullYear();

                if (!employeesByOrg.has(orgId)) {
                    employeesByOrg.set(orgId, []);
                }
                employeesByOrg.get(orgId).push({ employee: emp, yearsOfService });
            }
        });

        for (const [orgId, empDataList] of employeesByOrg.entries()) {
            for (const { employee, yearsOfService } of empDataList) {
                await sendWorkAnniversaryNotification(employee, yearsOfService, orgId);
            }
        }

        logger.info('Work anniversary notifications check completed', {
            totalAnniversaries: anniversaryEmployees.length
        });
    } catch (error) {
        logger.error('Error in work anniversary notification check', { error: error.message });
    }
};

/**
 * Schedule all special event notification jobs
 */
export const scheduleSpecialEventNotificationJobs = () => {
    cron.schedule('0 8 * * *', async () => {
        await checkHolidayNotifications();
    });

    cron.schedule('45 9 * * *', async () => {
        await checkBirthdayNotifications();
    });

    cron.schedule('45 9 * * *', async () => {
        await checkWorkAnniversaryNotifications();
    });

    logger.info('Special event notification jobs scheduled');
};

export default {
    scheduleSpecialEventNotificationJobs,
    checkHolidayNotifications,
    checkBirthdayNotifications,
    checkWorkAnniversaryNotifications
};
