// lib/graphCalendar.js
// Creates a calendar event on an elder's own Outlook calendar when a
// member books an appointment with them, via Graph's application-only
// client-credentials flow (same token/app registration as graphMail.js
// and graphDirectory.js — see graphClient.js).
//
// Requires an additional APPLICATION permission on the existing app
// registration: Calendars.ReadWrite, admin-consented. This is NOT
// something this code can grant itself — it's a one-time manual step in
// the Azure Portal (App registrations -> this app -> API permissions ->
// Add a permission -> Microsoft Graph -> Application permissions ->
// Calendars.ReadWrite -> Grant admin consent). Without that consent,
// every call here fails with a 403 — which the caller treats the same
// as a missing Object ID: log it, don't block the booking.
//
// Scoped per the original calendar-sync plan: title "Membership meeting
// with {name}", Eastern time, normal visibility. 30-minute duration,
// matching the wizard's 30-minute time-slot grid (SLOT_ORDER in
// availability.js). Delete-on-cancel is NOT implemented here — there is
// no appointment-cancellation feature yet for it to hook into.

const { graphFetch } = require('./graphClient');

const SLOT_ORDER = [
  '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
  '9:30 PM', '10:00 PM',
];

/** Parses a "9:00 AM" style slot into 24-hour {hour, minute}. */
function parseSlot(timeSlot) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeSlot.trim());
  if (!match) throw new Error(`Unrecognized time slot format: ${timeSlot}`);
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Creates a 30-minute event on the elder's own Outlook calendar.
 * Throws on failure — callers should catch this the same way they
 * already catch email failures, and not let it block the booking.
 *
 * @param {Object} opts
 * @param {string} opts.elderObjectId - the elder's M365 Object ID
 * @param {string} opts.elderEmail - only used for a clearer error message
 * @param {string} opts.memberName
 * @param {string} opts.campusName
 * @param {string} opts.date - YYYY-MM-DD
 * @param {string} opts.timeSlot - e.g. "9:00 AM"
 */
async function createCalendarEvent({ elderObjectId, elderEmail, memberName, campusName, date, timeSlot }) {
  if (!elderObjectId) {
    throw new Error(`No M365 Object ID on file for elder (${elderEmail || 'unknown'}) — cannot create calendar event`);
  }

  const { hour, minute } = parseSlot(timeSlot);
  const [year, month, day] = date.split('-').map((n) => parseInt(n, 10));

  const startDateTime = `${date}T${pad(hour)}:${pad(minute)}:00`;
  const endDate = new Date(Date.UTC(year, month - 1, day, hour, minute + 30));
  const endDateTime = `${date}T${pad(endDate.getUTCHours())}:${pad(endDate.getUTCMinutes())}:00`;

  const event = {
    subject: `Membership meeting with ${memberName}`,
    start: { dateTime: startDateTime, timeZone: 'Eastern Standard Time' },
    end: { dateTime: endDateTime, timeZone: 'Eastern Standard Time' },
    location: { displayName: `${campusName} — Welcome Center` },
    sensitivity: 'normal',
    body: {
      contentType: 'Text',
      content: `Membership meeting with ${memberName} at ${campusName}. Meet at the welcome center.`,
    },
  };

  await graphFetch(`/users/${encodeURIComponent(elderObjectId)}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

module.exports = { createCalendarEvent, SLOT_ORDER };
