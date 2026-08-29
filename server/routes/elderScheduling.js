// routes/elderScheduling.js
// All HTTP endpoints for the member-facing wizard, the elder self-service
// form, and admin lookups — shared by BOTH the web client and the mobile
// app, now that the two backends are merged. Every route below is used by
// both clients unless a comment says otherwise; the only thing that
// differs per client is how a request proves who it is (a session cookie
// for the web browser, a Bearer JWT for the mobile app) — see
// lib/schedulerAuth.js and lib/manageAuth.js for that split. Route logic
// itself is now shared in exactly one place, where it used to be
// duplicated between this repo's server/ and elder-android-backend.
//
// Web-only: /auth/login, /auth/callback, /auth/me (the browser redirect
// sign-in flow), and /elder-sync/refresh (the M365 roster sync).
// Mobile-only: /admin-auth (the Expo app signs in itself and POSTs the
// resulting id_token here for verification).

const express = require('express');
const { listRecords, createRecord, deleteRecords, getRecord } = require('../lib/airtable');
const availability = require('../lib/availability');
const mail = require('../lib/graphMail');
const calendar = require('../lib/graphCalendar');
const manageAuth = require('../lib/manageAuth');
const schedulerAuth = require('../lib/schedulerAuth');
const wacCodes = require('../lib/wacCodes');
const elderSync = require('../lib/elderSync');
const elderObjectIdBackfill = require('../lib/elderObjectIdBackfill');
const config = require('../config');

const router = express.Router();

// --- Member wizard login (WAC code — replaces the old shared PIN).
// Issues a cookie AND a bearer token; each client uses whichever applies
// to it. See lib/schedulerAuth.js. ---

router.post('/scheduler-auth', (req, res, next) => schedulerAuth.checkCode(req, res, next));

// --- Campuses ---

router.get('/campuses', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const records = await listRecords(config.airtable.tables.campuses);
    res.json(records.map((r) => ({ id: r.id, name: r.fields['Name'] })));
  } catch (err) {
    next(err);
  }
});

// --- Member wizard: cascading availability ---

router.get('/dates', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusId, campusName, dayOfWeek, classDate, elderName } = req.query;
    if (!campusName) return res.status(400).json({ error: 'campusName is required' });
    if (!classDate) return res.status(400).json({ error: 'classDate is required' });
    const dates = await availability.getAvailableDates(campusId, campusName, dayOfWeek || 'Sunday', classDate, elderName);
    res.json(dates);
  } catch (err) {
    next(err);
  }
});

router.get('/times', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusId, campusName, date, elderName } = req.query;
    if (!campusName || !date) {
      return res.status(400).json({ error: 'campusName and date are required' });
    }
    const times = await availability.getAvailableTimes(campusId, campusName, date, elderName);
    res.json(times);
  } catch (err) {
    next(err);
  }
});

// --- Preferred-elder lookup (campus roster, no date/time filtering yet) ---

router.get('/campus-elders', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusName } = req.query;
    if (!campusName) return res.status(400).json({ error: 'campusName is required' });
    const elders = await availability.getEldersForCampusPublic(campusName);
    res.json(elders);
  } catch (err) {
    next(err);
  }
});

router.get('/elders', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusId, campusName, date, timeSlot } = req.query;
    if (!campusName || !date || !timeSlot) {
      return res.status(400).json({ error: 'campusName, date, and timeSlot are required' });
    }
    const elders = await availability.getAvailableElders(campusId, campusName, date, timeSlot);
    res.json(elders.map((e) => ({ id: e.id, name: e.fields['Full Name'] })));
  } catch (err) {
    next(err);
  }
});

// --- Booking submission ---

router.post('/appointments', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusName, elderName, date, timeSlot, memberName, memberEmail, memberPhone } = req.body;
    if (!campusName || !elderName || !date || !timeSlot || !memberName || !memberEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await availability.createAppointment({ campusName, elderName, date, timeSlot, memberName, memberEmail, memberPhone });

    const elderRecords = await listRecords(config.airtable.tables.elders, {
      filterByFormula: `{Full Name} = '${elderName.replace(/'/g, "\\'")}'`,
    });
    const elderEmail = elderRecords[0]?.fields?.['Email'];
    const elderObjectId = elderRecords[0]?.fields?.['M365 Object ID'];

    const summary = `Campus: ${campusName}\nElder: ${elderName}\nDate: ${date}\nTime: ${timeSlot}\nMember: ${memberName} (${memberEmail})`;

    // Weekday + month + day, matching how the booking wizard itself
    // displays the date on-screen. The UTC-bug pattern applies here too:
    // `date` arrives as a bare YYYY-MM-DD, which needs T00:00:00 appended
    // before constructing a Date or it can parse a day early in
    // negative-UTC-offset zones.
    const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // INTERIM template (Aug 2026) — replaces the terse placeholder body
    // for the member-facing email only, until per-elder custom templates
    // (Phase 4) exist. Elder- and OME-facing emails intentionally stay
    // as their short existing versions for now.
    const memberBody =
      `Thank you for scheduling an appointment with ${elderName} on ${formattedDate} at ${timeSlot}. ` +
      `Please meet him at the welcome center on your campus. Any of our First Impressions team ` +
      `members can help connect the two of you if needed.\n\n` +
      `${elderName} is also receiving a notification of this appointment. If you need to reach ` +
      `him for any reason, his email address is ${elderEmail || '(not on file)'}.\n\n` +
      `If he needs to reach you, he will use the email or phone number with which you registered. ` +
      `If they are not correctly shown below, please be sure to reach out to him to let him know.\n\n` +
      `${memberEmail}\n${memberPhone || '(no phone number provided)'}\n\n` +
      `If either of you are unable to reach one another, our Office of Membership and Engagement ` +
      `is available to help at any time. Their email is engagement@gocoastal.org and the phone ` +
      `number is 757.867.5683.`;

    // The booking itself already succeeded above — that's the part that
    // matters. Email is a secondary effect: if it fails, log it
    // server-side and tell the client via `emailSent: false`, but don't
    // fail the whole request.
    let emailSent = true;
    try {
      await Promise.all([
        mail.sendMail({
          to: memberEmail,
          subject: 'Your meeting with an Elder is confirmed',
          body: memberBody,
        }),
        elderEmail
          ? mail.sendMail({
              to: elderEmail,
              subject: 'New meeting scheduled',
              body: `A member has scheduled a meeting with you.\n\n${summary}`,
            })
          : Promise.resolve(),
        mail.sendMail({
          to: config.notifications.omeEmail,
          subject: 'New Elder meeting scheduled (FYI)',
          body: `FYI — a new meeting was scheduled.\n\n${summary}`,
        }),
      ]);
    } catch (emailErr) {
      console.error('Booking saved, but email failed:', emailErr);
      emailSent = false;
    }

    // M365 calendar sync — same non-blocking philosophy as email above.
    // Most elder records still lack an M365 Object ID (Phase 4 backfill
    // not yet run), so this is expected to no-op for most bookings today.
    // That's fine: the booking and both emails already succeeded, this is
    // a bonus on top, not a requirement.
    let calendarEventCreated = true;
    try {
      await calendar.createCalendarEvent({
        elderObjectId,
        elderEmail,
        memberName,
        campusName,
        date,
        timeSlot,
      });
    } catch (calErr) {
      console.error('Booking saved, but calendar event failed:', calErr.message);
      calendarEventCreated = false;
    }

    res.status(201).json({ success: true, emailSent, calendarEventCreated });
  } catch (err) {
    if (err.message === 'SLOT_NO_LONGER_AVAILABLE') {
      return res.status(409).json({ error: 'That time was just booked by someone else. Please pick another.' });
    }
    next(err);
  }
});

// --- "None of these options work for me" -> engagement branch ---

router.post('/contact-engagement', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusName, memberName, memberEmail, notes } = req.body;
    if (!campusName || !memberName || !memberEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await availability.createEngagementRequest({ campusName, memberName, memberEmail, notes });

    let emailSent = true;
    try {
      await mail.sendMail({
        to: config.notifications.omeEmail,
        subject: 'Member needs help finding an elder/time',
        body: `A member didn't find an elder or time that worked for them.\n\nCampus: ${campusName}\nMember: ${memberName} (${memberEmail})\nNotes: ${notes || '(none)'}`,
      });
    } catch (emailErr) {
      console.error('Engagement request saved, but email failed:', emailErr);
      emailSent = false;
    }

    res.status(201).json({ success: true, emailSent });
  } catch (err) {
    next(err);
  }
});

// --- Sunday opt-out branch ---

router.post('/sunday-optout', schedulerAuth.requireSchedulerAuth, async (req, res, next) => {
  try {
    const { campusName, memberName, memberEmail, notes } = req.body;
    if (!campusName || !memberName || !memberEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await availability.createSundayOptOut({ campusName, memberName, memberEmail, notes });

    let emailSent = true;
    try {
      await mail.sendMail({
        to: config.notifications.omeEmail,
        subject: 'Member cannot meet on Sunday (FYI)',
        body: `A member requested a non-Sunday meeting time.\n\nCampus: ${campusName}\nMember: ${memberName} (${memberEmail})\nNotes: ${notes || '(none)'}`,
      });
    } catch (emailErr) {
      console.error('Opt-out saved, but email failed:', emailErr);
      emailSent = false;
    }

    res.status(201).json({ success: true, emailSent });
  } catch (err) {
    next(err);
  }
});

// --- Elder/Admin sign-in ---
// Web: server-side redirect flow (a real browser navigation, not fetch).
router.get('/auth/login', manageAuth.startLogin);
router.get('/auth/callback', manageAuth.handleCallback);

// Web only: lets the frontend find out on page load whether someone's
// already signed in, without the httpOnly session cookie being readable
// from JS directly.
router.get('/auth/me', manageAuth.requireAdminAuth, (req, res) => {
  res.json({ role: req.auth.role, name: req.auth.name, elderName: req.auth.elderName });
});

// Mobile only: the Expo app signs in itself (PKCE) and POSTs the
// resulting id_token here to be verified.
router.post('/admin-auth', (req, res) => manageAuth.checkEntraLogin(req, res));

// --- Elder self-service availability. Hybrid scoping: role 'elder' is
// forced to their own record (matched at login by email); role 'admin'
// can operate on any elder by name. ---

router.get('/elder-availability', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    let elderName = req.query.elderName;
    if (req.auth.role === 'elder') {
      if (!req.auth.elderName) {
        return res.status(404).json({ error: 'No elder record matches your signed-in account.' });
      }
      elderName = req.auth.elderName;
    } else if (!elderName) {
      return res.status(400).json({ error: 'elderName is required' });
    }

    const rows = await listRecords(config.airtable.tables.availability, {
      filterByFormula: `{Elder Name} = '${elderName.replace(/'/g, "\\'")}'`,
    });
    res.json(rows.map((r) => ({ id: r.id, ...r.fields })));
  } catch (err) {
    next(err);
  }
});

router.post('/elder-availability', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    let { elderName, dayOfWeek, weekOfMonth, timeSlots } = req.body;

    if (req.auth.role === 'elder') {
      if (!req.auth.elderName) {
        return res.status(404).json({ error: 'No elder record matches your signed-in account.' });
      }
      elderName = req.auth.elderName;
    }

    if (!elderName || !dayOfWeek || !Array.isArray(weekOfMonth) || !Array.isArray(timeSlots)) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }
    const record = await createRecord(config.airtable.tables.availability, {
      'Elder Name': elderName,
      'Day of Week': dayOfWeek,
      'Week of Month': weekOfMonth,
      'Time Slots': timeSlots,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/elder-availability/:id', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role === 'elder') {
      const record = await getRecord(config.airtable.tables.availability, req.params.id);
      if (record.fields['Elder Name'] !== req.auth.elderName) {
        return res.status(403).json({ error: 'You can only manage your own availability.' });
      }
    }
    await deleteRecords(config.airtable.tables.availability, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Elder picker (admin-only — self-service elders already know who
// they are, via req.auth.elderName) ---

router.get('/all-elders', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can browse all elders.' });
    }
    const records = await listRecords(config.airtable.tables.elders);
    res.json(
      records.map((r) => ({
        id: r.id,
        name: r.fields['Full Name'],
        campus: r.fields['Campus'],
      }))
    );
  } catch (err) {
    next(err);
  }
});

// --- M365 elder roster sync (admin-only manual refresh). Web-only for
// now — nothing in the mobile app currently surfaces this action, but
// it's not gated to a particular client, just to the admin role. ---

router.post('/elder-sync/refresh', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can refresh the elder roster.' });
    }
    const summary = await elderSync.refreshFromM365();
    res.json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
});

// One-time backfill: fills in the M365 Object ID on manually-seeded elder
// records by exact email match, so the calendar-sync feature knows whose
// Outlook calendar to write to. See lib/elderObjectIdBackfill.js for why
// this is deliberately separate from /elder-sync/refresh above — running
// that refresh on a Manual elder still missing an Object ID creates a
// duplicate record instead of filling in the gap.
//
// Defaults to a dry run (nothing written) so results can be reviewed
// before committing — pass { "confirm": true } in the body for a real run.
router.post('/elder-sync/backfill-object-ids', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can run the Object ID backfill.' });
    }
    const result = await elderObjectIdBackfill.run({ confirm: req.body?.confirm === true });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Elder self-service time off (same hybrid scoping as availability) ---

router.get('/elder-timeoff', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    let elderName = req.query.elderName;
    if (req.auth.role === 'elder') {
      if (!req.auth.elderName) {
        return res.status(404).json({ error: 'No elder record matches your signed-in account.' });
      }
      elderName = req.auth.elderName;
    } else if (!elderName) {
      return res.status(400).json({ error: 'elderName is required' });
    }

    const rows = await listRecords(config.airtable.tables.timeOff, {
      filterByFormula: `{Elder Name} = '${elderName.replace(/'/g, "\\'")}'`,
    });
    res.json(rows.map((r) => ({ id: r.id, ...r.fields })));
  } catch (err) {
    next(err);
  }
});

router.post('/elder-timeoff', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    let { elderName, startDate, endDate, notes } = req.body;

    if (req.auth.role === 'elder') {
      if (!req.auth.elderName) {
        return res.status(404).json({ error: 'No elder record matches your signed-in account.' });
      }
      elderName = req.auth.elderName;
    }

    if (!elderName || !startDate || !endDate) {
      return res.status(400).json({ error: 'elderName, startDate, and endDate are required' });
    }
    const record = await createRecord(config.airtable.tables.timeOff, {
      'Elder Name': elderName,
      'Start Date': startDate,
      'End Date': endDate,
      Notes: notes || '',
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/elder-timeoff/:id', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role === 'elder') {
      const record = await getRecord(config.airtable.tables.timeOff, req.params.id);
      if (record.fields['Elder Name'] !== req.auth.elderName) {
        return res.status(403).json({ error: 'You can only manage your own time off.' });
      }
    }
    await deleteRecords(config.airtable.tables.timeOff, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Admin: WAC class code management ---

router.get('/wac-codes', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage WAC codes.' });
    }
    const codes = await wacCodes.listCodes();
    res.json(codes);
  } catch (err) {
    next(err);
  }
});

router.post('/wac-codes', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage WAC codes.' });
    }
    const { code, campusName, classDate } = req.body;
    if (!code || !campusName || !classDate) {
      return res.status(400).json({ error: 'code, campusName, and classDate are required' });
    }
    const record = await wacCodes.createCode({ code, campusName, classDate });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/wac-codes/:id', manageAuth.requireAdminAuth, async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage WAC codes.' });
    }
    await wacCodes.deactivateCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
