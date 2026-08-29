// lib/availability.js
// The availability-calculation and conflict-checking logic that used to be
// missing from every off-the-shelf option we evaluated (Bookings' weekly-
// only recurrence, Airtable Interfaces' account requirement, etc.). This is
// the actual "product" of this whole project — everything else is plumbing
// around this file.

const { listRecords, createRecord, updateRecords } = require('./airtable');
const config = require('../config');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// How many days after the "We Are Coastal" class date a member must wait
// before meeting with an Elder.
const MIN_LEAD_DAYS = 7;

function dayName(date) {
  return DAY_NAMES[date.getUTCDay()];
}

function weekOfMonth(date) {
  const dayOfMonth = date.getUTCDate();
  const nth = Math.ceil(dayOfMonth / 7); // 1-5, matches the Availability table's "Week of Month" choices
  const labels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };
  return labels[nth] || '5th';
}

function isoDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function escapeFormulaValue(value) {
  return String(value).replace(/'/g, "\\'");
}

/** Fetch elder records for a given campus name — restricted to elders that
 *  are Active and marked Visible In Wizard, since this feeds every
 *  member-facing booking-flow lookup (dates, times, elder selection).
 *  Inactive elders (removed from the M365 group but kept for history) and
 *  elders explicitly hidden from the public wizard (e.g. the Demo elder)
 *  are still fully manageable via /manage — they just never appear here. */
async function getEldersForCampus(campusName) {
  return listRecords(config.airtable.tables.elders, {
    filterByFormula: `AND({Campus} = '${escapeFormulaValue(campusName)}', {Status} = 'Active', {Visible In Wizard} = TRUE())`,
  });
}

/** Public-safe elder lookup for the member wizard's "preferred elder" step
 *  (the existing /all-elders route is gated behind manageAuth, which is the
 *  wrong gate for member-facing use, so this is the schedulerAuth-gated
 *  equivalent, scoped to one campus). Includes a plain-language summary of
 *  each elder's recurring availability pattern — not live open slots (that
 *  gets computed per-elder, once one is actually picked, via
 *  getAvailableDates/getAvailableTimes below). */
function summarizeAvailabilityRows(rows) {
  return rows.map((r) => {
    const weeks = r.fields['Week of Month'] || [];
    const slots = r.fields['Time Slots'] || [];
    const day = r.fields['Day of Week'] || '';
    const weekLabel = weeks.includes('Every Week')
      ? `Every ${day}`
      : weeks.length > 0
        ? `${weeks.join(', ')} ${day}`
        : day;
    const timeLabel = SLOT_ORDER.filter((s) => slots.includes(s)).join(', ') || '(no times set)';
    return `${weekLabel} at ${timeLabel}`;
  });
}

/** Public-safe elder lookup for the "preferred elder" step — names only,
 *  no availability preview. Real availability is shown on the follow-up
 *  screen (getAvailabilityWindow below) once one elder is actually
 *  picked, rather than approximated here for every elder up front. */
async function getEldersForCampusPublic(campusName) {
  const elders = await getEldersForCampus(campusName);
  return elders.map((e) => ({ id: e.id, name: e.fields['Full Name'] }));
}

/** Fetch Availability rows for a list of elder names, for a specific day of week. */
async function getAvailabilityForElders(elderNames, dayOfWeek) {
  if (elderNames.length === 0) return [];
  const nameClauses = elderNames.map((n) => `{Elder Name} = '${escapeFormulaValue(n)}'`).join(', ');
  return listRecords(config.airtable.tables.availability, {
    filterByFormula: `AND(OR(${nameClauses}), {Day of Week} = '${dayOfWeek}')`,
  });
}

/** Fetch TimeOff rows for a list of elder names that overlap a given date. */
async function getTimeOffForElders(elderNames, dateStr) {
  if (elderNames.length === 0) return [];
  const nameClauses = elderNames.map((n) => `{Elder Name} = '${escapeFormulaValue(n)}'`).join(', ');
  return listRecords(config.airtable.tables.timeOff, {
    filterByFormula: `AND(OR(${nameClauses}), IS_BEFORE({Start Date}, '${dateStr}T23:59:59.000Z'), IS_AFTER({End Date}, '${dateStr}T00:00:00.000Z'))`,
  });
}

/** Fetch confirmed Appointments for a given date (optionally narrowed to a campus). */
async function getConfirmedAppointments(dateStr, campusName) {
  const clauses = [`{Date} = '${dateStr}'`, `{Status} = 'Confirmed'`];
  if (campusName) clauses.push(`{Campus} = '${escapeFormulaValue(campusName)}'`);
  return listRecords(config.airtable.tables.appointments, {
    filterByFormula: `AND(${clauses.join(', ')})`,
  });
}

/**
 * Returns up to config.scheduling.weeksAhead upcoming dates for a given
 * day-of-week (default Sunday) where at least one elder at the campus has
 * an open slot — and which fall at least MIN_LEAD_DAYS after classDate.
 * If elderName is given, narrows to that one elder's open slots only.
 *
 * The search cursor starts at whichever is later: today, or
 * (classDate + MIN_LEAD_DAYS). There's no upper bound on how far forward it
 * searches — only on how many qualifying results it collects — so a very
 * recent class date just means it walks further out before finding the
 * first eligible Sunday, rather than coming back empty.
 */
async function getAvailableDates(campusId, campusName, dayOfWeek = 'Sunday', classDate, elderName) {
  const elders = await getEldersForCampus(campusName);
  const elderNames = elderName ? [elderName] : elders.map((e) => e.fields['Full Name']);
  if (elderNames.length === 0) return [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let cursor = today;
  if (classDate) {
    const earliestAllowed = new Date(`${classDate}T00:00:00.000Z`);
    earliestAllowed.setUTCDate(earliestAllowed.getUTCDate() + MIN_LEAD_DAYS);
    if (earliestAllowed > cursor) cursor = earliestAllowed;
  }
  cursor = new Date(cursor); // clone, since we mutate it below

  while (dayName(cursor) !== dayOfWeek) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const results = [];
  // Circuit breaker so a data-entry gap in Availability can't hang a request
  // indefinitely — 104 weeks (2 years) is far more than this should ever need.
  let iterations = 0;
  const MAX_ITERATIONS = 104;

  while (results.length < config.scheduling.weeksAhead && iterations < MAX_ITERATIONS) {
    iterations++;
    const dateStr = isoDate(cursor);
    const wom = weekOfMonth(cursor);

    const availRows = await getAvailabilityForElders(elderNames, dayOfWeek);
    const matchingRows = availRows.filter((r) => {
      const weeks = r.fields['Week of Month'] || [];
      return weeks.includes(wom) || weeks.includes('Every Week');
    });

    if (matchingRows.length > 0) {
      const timeOffRows = await getTimeOffForElders(elderNames, dateStr);
      const appts = await getConfirmedAppointments(dateStr, campusName);
      const bookedElderTimeSlots = new Set(
        appts.map((a) => `${a.fields['Elder Name']}|${a.fields['Time Slot']}`)
      );

      const anyOpenSlot = matchingRows.some((r) => {
        const elderName = r.fields['Elder Name'];
        const onTimeOff = timeOffRows.some((t) => t.fields['Elder Name'] === elderName);
        if (onTimeOff) return false;
        const slots = r.fields['Time Slots'] || [];
        return slots.some((slot) => !bookedElderTimeSlots.has(`${elderName}|${slot}`));
      });

      if (anyOpenSlot) results.push(dateStr);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return results;
}

/** Returns the union of open time slots for a campus on a specific date,
 *  or — if elderName is provided — only that one elder's open slots. */
async function getAvailableTimes(campusId, campusName, dateStr, elderName) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = dayName(date);
  const wom = weekOfMonth(date);

  const elders = await getEldersForCampus(campusName);
  const elderNames = elderName ? [elderName] : elders.map((e) => e.fields['Full Name']);
  if (elderNames.length === 0) return [];

  const availRows = await getAvailabilityForElders(elderNames, dow);
  const matchingRows = availRows.filter((r) => {
    const weeks = r.fields['Week of Month'] || [];
    return weeks.includes(wom) || weeks.includes('Every Week');
  });

  const timeOffRows = await getTimeOffForElders(elderNames, dateStr);
  const appts = await getConfirmedAppointments(dateStr, campusName);
  const bookedElderTimeSlots = new Set(
    appts.map((a) => `${a.fields['Elder Name']}|${a.fields['Time Slot']}`)
  );

  const openSlots = new Set();
  for (const row of matchingRows) {
    const name = row.fields['Elder Name'];
    if (timeOffRows.some((t) => t.fields['Elder Name'] === name)) continue;
    for (const slot of row.fields['Time Slots'] || []) {
      if (!bookedElderTimeSlots.has(`${name}|${slot}`)) openSlots.add(slot);
    }
  }

  // Sort chronologically using the canonical slot order.
  return SLOT_ORDER.filter((s) => openSlots.has(s));
}

/** Returns the elders at a campus who are free at a specific date+time. */
async function getAvailableElders(campusId, campusName, dateStr, timeSlot) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = dayName(date);
  const wom = weekOfMonth(date);

  const elders = await getEldersForCampus(campusName);
  const elderNames = elders.map((e) => e.fields['Full Name']);

  const availRows = await getAvailabilityForElders(elderNames, dow);
  const timeOffRows = await getTimeOffForElders(elderNames, dateStr);
  const appts = await getConfirmedAppointments(dateStr, campusName);
  const bookedElderTimeSlots = new Set(
    appts.map((a) => `${a.fields['Elder Name']}|${a.fields['Time Slot']}`)
  );

  return elders.filter((e) => {
    const name = e.fields['Full Name'];
    const rows = availRows.filter((r) => r.fields['Elder Name'] === name);
    const hasSlot = rows.some((r) => {
      const weeks = r.fields['Week of Month'] || [];
      const slots = r.fields['Time Slots'] || [];
      return (weeks.includes(wom) || weeks.includes('Every Week')) && slots.includes(timeSlot);
    });
    if (!hasSlot) return false;
    if (timeOffRows.some((t) => t.fields['Elder Name'] === name)) return false;
    if (bookedElderTimeSlots.has(`${name}|${timeSlot}`)) return false;
    return true;
  });
}

const SLOT_ORDER = [
  '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
  '9:30 PM', '10:00 PM',
];

/**
 * Creates an appointment IF the slot is still free (re-checks at write time
 * to close the race condition between a user viewing options and submitting).
 * Throws if the elder/date/time is no longer available.
 */
async function createAppointment({ campusName, elderName, date, timeSlot, memberName, memberEmail }) {
  const appts = await getConfirmedAppointments(date, campusName);
  const conflict = appts.some(
    (a) => a.fields['Elder Name'] === elderName && a.fields['Time Slot'] === timeSlot
  );
  if (conflict) {
    throw new Error('SLOT_NO_LONGER_AVAILABLE');
  }

  return createRecord(config.airtable.tables.appointments, {
    'Member Name': memberName,
    'Member Email': memberEmail,
    Campus: campusName,
    'Elder Name': elderName,
    Date: date,
    'Time Slot': timeSlot,
    Status: 'Confirmed',
    'Created At': new Date().toISOString(),
  });
}

async function createSundayOptOut({ campusName, memberName, memberEmail, notes }) {
  return createRecord(config.airtable.tables.sundayOptOut, {
    'Member Name': memberName,
    'Member Email': memberEmail,
    Campus: campusName,
    Notes: notes || '',
    'Created At': new Date().toISOString(),
  });
}

/** "None of these elders/times work for me" escape hatch from the
 *  preferred-elder step — logged the same way Sunday opt-outs are, so
 *  engagement has a record to follow up on manually. */
async function createEngagementRequest({ campusName, memberName, memberEmail, notes }) {
  return createRecord(config.airtable.tables.engagementRequests, {
    'Member Name': memberName,
    'Member Email': memberEmail,
    Campus: campusName,
    Notes: notes || '',
    'Created At': new Date().toISOString(),
  });
}

/**
 * All of one elder's open date+time combinations over the next
 * WINDOW_DAYS days (the "choose your preferred elder" step's follow-up
 * screen — a real, bookable 2-week view, not just a recurring-pattern
 * summary). Bounds the search by calendar days rather than a result
 * count, since "next two weeks" is a date range.
 *
 * @returns {Promise<Array<{date: string, times: string[]}>>}
 */
const WINDOW_DAYS = 14;

async function getAvailabilityWindow(campusName, elderName, classDate) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let cursor = today;
  if (classDate) {
    const earliestAllowed = new Date(`${classDate}T00:00:00.000Z`);
    earliestAllowed.setUTCDate(earliestAllowed.getUTCDate() + MIN_LEAD_DAYS);
    if (earliestAllowed > cursor) cursor = earliestAllowed;
  }
  cursor = new Date(cursor);

  const windowEnd = new Date(today);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + WINDOW_DAYS);

  const candidateDates = [];
  for (let d = new Date(cursor); d <= windowEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    candidateDates.push(isoDate(d));
  }
  if (candidateDates.length === 0) return [];

  // Three Airtable calls total for the whole window — this elder's full
  // Availability, TimeOff, and confirmed Appointments — rather than three
  // calls PER DAY. An earlier version called getAvailableTimes once per
  // candidate date (up to ~15), which either ran sequentially (slow) or
  // in parallel (which fires ~45 simultaneous Airtable requests and trips
  // Airtable's rate limit, throwing and surfacing as a generic 500).
  // Fetching once and computing every day's open slots in memory avoids
  // both problems and is the fastest option besides.
  const [availRows, timeOffRows, apptRows] = await Promise.all([
    listRecords(config.airtable.tables.availability, {
      filterByFormula: `{Elder Name} = '${escapeFormulaValue(elderName)}'`,
    }),
    listRecords(config.airtable.tables.timeOff, {
      filterByFormula: `{Elder Name} = '${escapeFormulaValue(elderName)}'`,
    }),
    listRecords(config.airtable.tables.appointments, {
      filterByFormula: `AND({Elder Name} = '${escapeFormulaValue(elderName)}', {Campus} = '${escapeFormulaValue(campusName)}', {Status} = 'Confirmed')`,
    }),
  ]);

  const bookedSlotsByDate = {};
  for (const appt of apptRows) {
    const d = appt.fields['Date'];
    const slot = appt.fields['Time Slot'];
    if (!bookedSlotsByDate[d]) bookedSlotsByDate[d] = new Set();
    bookedSlotsByDate[d].add(slot);
  }

  const results = [];
  for (const dateStr of candidateDates) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const dow = dayName(date);
    const wom = weekOfMonth(date);

    const matchingRows = availRows.filter((r) => {
      const weeks = r.fields['Week of Month'] || [];
      return r.fields['Day of Week'] === dow && (weeks.includes(wom) || weeks.includes('Every Week'));
    });
    if (matchingRows.length === 0) continue;

    // TimeOff's Start Date/End Date are plain Airtable "date" fields, which
    // the API returns as bare YYYY-MM-DD strings — safe to compare
    // lexicographically against dateStr without constructing more Dates.
    const onTimeOff = timeOffRows.some(
      (t) => t.fields['Start Date'] <= dateStr && t.fields['End Date'] >= dateStr
    );
    if (onTimeOff) continue;

    const booked = bookedSlotsByDate[dateStr] || new Set();
    const openSlots = new Set();
    for (const row of matchingRows) {
      for (const slot of row.fields['Time Slots'] || []) {
        if (!booked.has(slot)) openSlots.add(slot);
      }
    }

    const times = SLOT_ORDER.filter((s) => openSlots.has(s));
    if (times.length > 0) {
      results.push({ date: dateStr, times });
    }
  }

  return results;
}

/**
 * Picks the "next" elder at a campus in round-robin order, so repeated
 * "no preference" bookings cycle through everyone rather than landing on
 * the same person disproportionately. Order is alphabetical by name
 * (stable and reproducible without needing to store an explicit order),
 * and RoundRobinState (one row per campus) remembers who went last.
 *
 * Not concurrency-safe against two simultaneous requests for the same
 * campus (a plain read-then-write, no locking) — acceptable for this
 * volume of traffic.
 */
async function pickRoundRobinElder(campusName) {
  const elders = await getEldersForCampus(campusName);
  if (elders.length === 0) return null;

  const sortedNames = elders.map((e) => e.fields['Full Name']).sort((a, b) => a.localeCompare(b));

  const stateRows = await listRecords(config.airtable.tables.roundRobinState, {
    filterByFormula: `{Campus Key} = '${escapeFormulaValue(campusName)}'`,
  });
  const stateRecord = stateRows[0];
  const lastElderName = stateRecord?.fields['Last Elder Name'];

  const lastIndex = lastElderName ? sortedNames.indexOf(lastElderName) : -1;
  const nextIndex = (lastIndex + 1) % sortedNames.length;
  const nextName = sortedNames[nextIndex];

  if (stateRecord) {
    await updateRecords(config.airtable.tables.roundRobinState, [
      { id: stateRecord.id, fields: { 'Last Elder Name': nextName, 'Updated At': new Date().toISOString() } },
    ]);
  } else {
    await createRecord(config.airtable.tables.roundRobinState, {
      'Campus Key': campusName,
      Campus: campusName,
      'Last Elder Name': nextName,
      'Updated At': new Date().toISOString(),
    });
  }

  const elderRecord = elders.find((e) => e.fields['Full Name'] === nextName);
  return { id: elderRecord.id, name: nextName };
}

module.exports = {
  getAvailableDates,
  getAvailableTimes,
  getAvailableElders,
  getAvailabilityWindow,
  pickRoundRobinElder,
  getEldersForCampusPublic,
  createAppointment,
  createSundayOptOut,
  createEngagementRequest,
  weekOfMonth,
  dayName,
};
