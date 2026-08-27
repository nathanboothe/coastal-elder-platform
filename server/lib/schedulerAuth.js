// server/lib/schedulerAuth.js
// Member-facing wizard login — validates a per-class WAC code (see
// lib/wacCodes.js) instead of the old single shared PIN.
//
// checkCode issues BOTH a signed httpOnly cookie (for the web client,
// same crypto-HMAC approach as before) AND a JWT bearer token in the
// JSON response (for the mobile client, which can't rely on a browser
// cookie jar the way a web page can). Each client just uses whichever
// one applies to it — the web frontend never reads the `token` field,
// and the mobile app never persists the cookie. Same idea as
// lib/manageAuth.js's requireAdminAuth: one shared validation path,
// two credential formats handed out depending on who's asking.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

/** Checks a WAC code and, if valid, sets a signed session cookie AND
 *  returns a JWT bearer token — both carrying the matched campus + class
 *  date. Returns those in the JSON response too, so the frontend (web or
 *  mobile) can show the "you attended at {campus}" step either way. */
async function checkCode(req, res, next) {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  // Bug found while testing the merged server, present before this
  // merge too: validateCode's Airtable call was previously unguarded
  // here — if Airtable errored (rate limit, network blip, bad table
  // name), the rejection was never caught and crashed the whole Node
  // process, taking down both the web and mobile clients at once. Now
  // it's routed to Express's normal error handler like every other
  // route in this file.
  let match;
  try {
    match = await wacCodes.validateCode(code);
  } catch (err) {
    return next(err);
  }

  if (!match) {
    return res.status(401).json({ error: "That code wasn't recognized. Check it and try again." });
  }

  const sessionPayload = { campus: match.campusName, classDate: match.classDate };

  const cookieToken = sign({ ...sessionPayload, expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  res.cookie(COOKIE_NAME, cookieToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });

  const bearerToken = jwt.sign({ scope: 'scheduler', ...sessionPayload }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  res.json({
    success: true,
    campus: match.campusName,
    classDate: match.classDate,
    token: bearerToken,
    expiresIn: config.jwt.expiresIn,
  });
}

/** Express middleware — accepts either a Bearer token (mobile) or the
 *  session cookie (web). Populates req.auth identically either way. */
function requireSchedulerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      if (payload.scope !== 'scheduler') {
        return res.status(403).json({ error: 'Token does not have booking access' });
      }
      req.auth = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  const cookies = parseCookies(req);
  const session = verify(cookies[COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({ error: 'Not authorized. Enter your code first.' });
  }
  req.auth = session;
  next();
}

module.exports = { checkCode, requireSchedulerAuth };
