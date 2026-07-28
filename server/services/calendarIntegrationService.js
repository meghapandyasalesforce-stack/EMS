/**
 * Calendar integration for exit interviews — ICS + vendor hooks (Teams/Meet/Outlook).
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function formatIcsDate(d) {
    return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildExitInterviewIcs({ session, employeeName, interviewerName, organizationName }) {
    const start = new Date(session.scheduledAt || session.scheduledDate);
    const end = new Date(start.getTime() + (session.durationMinutes || 45) * 60000);
    const uid = session._id || crypto.randomUUID();

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//EMS Lifecycle//Exit Interview//EN',
        'BEGIN:VEVENT',
        `UID:exit-interview-${uid}@ems`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:Exit Interview — ${employeeName || 'Employee'}`,
        `DESCRIPTION:Exit interview session. Interviewer: ${interviewerName || 'HR'}. Org: ${organizationName || ''}`,
        session.meetingUrl ? `URL:${session.meetingUrl}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
}

export async function createTeamsMeeting({ subject, start, end, attendeeEmails = [] }) {
    const token = process.env.MICROSOFT_GRAPH_TOKEN;
    if (!token) {
        return {
            provider: 'teams',
            meetingUrl: null,
            message: 'Set MICROSOFT_GRAPH_TOKEN for Teams integration',
            icsFallback: true,
        };
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            startDateTime: new Date(start).toISOString(),
            endDateTime: new Date(end).toISOString(),
            subject: subject || 'Exit Interview',
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Teams meeting creation failed');
    return {
        provider: 'teams',
        meetingUrl: data.joinWebUrl,
        meetingId: data.id,
    };
}

export async function createGoogleMeetEvent({ subject, start, end, calendarId = 'primary' }) {
    const token = process.env.GOOGLE_CALENDAR_TOKEN;
    if (!token) {
        return { provider: 'google_meet', meetingUrl: null, icsFallback: true };
    }

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            summary: subject || 'Exit Interview',
            start: { dateTime: new Date(start).toISOString() },
            end: { dateTime: new Date(end).toISOString() },
            conferenceData: {
                createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
            },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Google Meet creation failed');
    return {
        provider: 'google_meet',
        meetingUrl: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri,
        eventId: data.id,
    };
}

export async function scheduleExitInterviewCalendar(session, context = {}) {
    const provider = process.env.EXIT_INTERVIEW_CALENDAR_PROVIDER || 'ics';
    const start = session.scheduledAt || session.scheduledDate;
    const end = new Date(new Date(start).getTime() + (session.durationMinutes || 45) * 60000);

    let result;
    if (provider === 'teams') {
        result = await createTeamsMeeting({
            subject: `Exit Interview — ${context.employeeName}`,
            start,
            end,
        });
    } else if (provider === 'google_meet') {
        result = await createGoogleMeetEvent({
            subject: `Exit Interview — ${context.employeeName}`,
            start,
            end,
        });
    } else {
        result = { provider: 'ics', icsFallback: true };
    }

    const ics = buildExitInterviewIcs({ session, ...context });
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'calendar');
    await fs.mkdir(uploadsDir, { recursive: true });
    const fileName = `exit-interview-${session._id || Date.now()}.ics`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, ics, 'utf8');

    return {
        ...result,
        icsUrl: `/uploads/calendar/${fileName}`,
        icsContent: ics,
    };
}
