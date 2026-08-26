// server/lib/schedulerAuth.js
// Member-facing wizard login — validates a per-class WAC code (see
// lib/wacCodes.js) instead of a single shared PIN, and stores which
// campus/class date the code belongs to in the session cookie so the
// booking flow doesn't have to resend it. Same signed-cookie approach as
// before (crypto HMAC, no new dependency) — only WHAT gets checked and
// stored has changed.

const crypto = require('crypto');
const config = require('../config');
const wacCodes = require('./wacCodes');

const COOKIE_NAME = 'scheduler_session';
const SESSION_HOURS = 12;

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', config.scheduler.sessionSecret).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [data, hmac] = token.split('.');
  const expectedHmac = crypto.createHmac('sha256', config.scheduler.sessionSecret).update(data).digest('base64url');

  const a = Buffer.from(hmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((pair) => {
      const [key, ...rest] = pair.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    })
  );
}

/** Checks a WAC code and, if valid, sets a signed session cookie carrying
 *  the matched campus + class date. Returns those in the JSON response
 *  too, so the frontend can show the "you attended at {campus}" step. */
async function checkCode(req, res) {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  const match = await wacCodes.validateCode(code);
  if (!match) {
    return res.status(401).json({ error: "That code wasn't recognized. Check it and try again." });
  }

  const token = sign({
    campus: match.campusName,
    classDate: match.classDate,
    expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });

  res.json({ success: true, campus: match.campusName, classDate: match.classDate });
}

/** Express middleware — blocks the request unless a valid session cookie is present. */
function requireSchedulerAuth(req, res, next) {
  const cookies = parseCookies(req);
  const session = verify(cookies[COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({ error: 'Not authorized. Enter your code first.' });
  }
  req.auth = session;
  next();
}

module.exports = { checkCode, requireSchedulerAuth };
