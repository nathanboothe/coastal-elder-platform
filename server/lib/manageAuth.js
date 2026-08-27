// server/lib/manageAuth.js
// Elder/Admin sign-in and session handling — the merged home for BOTH:
//   - the web app's server-side Authorization Code redirect flow
//     (startLogin, handleCallback) — a browser gets redirected to
//     Microsoft and back, and this server holds the client secret
//   - the mobile app's token-verification flow (checkEntraLogin) — the
//     Expo app signs in itself (PKCE, public client, no secret) and
//     POSTs the resulting id_token here to be verified
//
// Both paths call the SAME lib/entraLogin.js to decide "who is this and
// are they allowed in" — that used to be duplicated between this file and
// elder-android-backend's schedulerAuth.js. What still legitimately
// differs is the credential each path hands back afterward: a browser
// gets an httpOnly signed cookie (same crypto-HMAC approach as before);
// a native app gets a JWT bearer token in the JSON response, because
// that's how each client actually holds onto a session.
//
// requireAdminAuth (below) is the single gate both clients pass through:
// it checks for a Bearer token first (mobile), then falls back to the
// session cookie (web). Every admin/elder route in
// routes/elderScheduling.js uses this one function now, regardless of
// which client is calling.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { resolveEntraLogin } = require('./entraLogin');

const SESSION_COOKIE = 'manage_session';
const STATE_COOKIE = 'manage_oauth_state';
const SESSION_HOURS = 12;

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', config.manage.sessionSecret).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [data, hmac] = token.split('.');
  const expectedHmac = crypto.createHmac('sha256', config.manage.sessionSecret).update(data).digest('base64url');

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

/** Step 1 (web only): redirect the browser to Microsoft's sign-in page.
 *  Called by navigating to this URL directly (a real link, not a fetch
 *  call) — the OAuth redirect needs a top-level browser navigation. */
function startLogin(req, res) {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 minutes — just needs to survive the redirect round trip
  });

  const params = new URLSearchParams({
    client_id: config.entra.clientId,
    response_type: 'code',
    redirect_uri: config.entra.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
  });

  res.redirect(
    `https://login.microsoftonline.com/${config.entra.tenantId}/oauth2/v2.0/authorize?${params.toString()}`
  );
}

/** Step 2 (web only): Microsoft redirects back here with a code (or an
 *  error). Exchanges the code, then hands the id_token to the shared
 *  resolveEntraLogin() for the actual role/elder resolution. */
async function handleCallback(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;
  const cookies = parseCookies(req);

  if (error) {
    return res.redirect(`/manage?error=${encodeURIComponent(errorDescription || error)}`);
  }
  if (!code || !state || state !== cookies[STATE_COOKIE]) {
    return res.redirect(
      '/manage?error=' + encodeURIComponent('Sign-in session expired or invalid. Please try again.')
    );
  }

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${config.entra.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.entra.clientId,
          client_secret: config.entra.clientSecret,
          code,
          redirect_uri: config.entra.redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('Entra token exchange failed:', body);
      return res.redirect('/manage?error=' + encodeURIComponent('Sign-in failed. Please try again.'));
    }

    const tokenData = await tokenRes.json();

    let identity;
    try {
      identity = await resolveEntraLogin(tokenData.id_token);
    } catch (err) {
      return res.redirect('/manage?error=' + encodeURIComponent(err.userMessage || 'Sign-in failed.'));
    }

    const session = sign({
      role: identity.role,
      name: identity.name,
      email: identity.email,
      elderId: identity.elderId,
      elderName: identity.elderName,
      expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    });

    res.clearCookie(STATE_COOKIE);
    res.cookie(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_HOURS * 60 * 60 * 1000,
    });

    res.redirect('/manage');
  } catch (err) {
    console.error('Entra sign-in callback failed:', err);
    res.redirect('/manage?error=' + encodeURIComponent('Sign-in failed. Please try again.'));
  }
}

/** Mobile only: the Expo app signs in itself (PKCE) and POSTs the
 *  resulting id_token here. Same identity resolution as the web flow
 *  above, but issues a JWT bearer token in the JSON response instead of
 *  a cookie, since that's how the mobile app actually holds a session. */
async function checkEntraLogin(req, res) {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  let identity;
  try {
    identity = await resolveEntraLogin(idToken);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.userMessage || 'Sign-in failed.' });
  }

  const token = jwt.sign(
    {
      scope: 'admin',
      role: identity.role,
      name: identity.name,
      email: identity.email,
      elderId: identity.elderId,
      elderName: identity.elderName,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({
    token,
    expiresIn: config.jwt.expiresIn,
    name: identity.name,
    role: identity.role,
    elderName: identity.elderName,
  });
}

/** The one gate every admin/elder route uses, regardless of which client
 *  is calling: a Bearer token (mobile) is checked first, then the
 *  session cookie (web). Populates req.auth identically either way —
 *  { role, name, email, elderId, elderName, ... } — so route handlers
 *  never need to know which client sent the request. */
function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      if (payload.scope !== 'admin') {
        return res.status(403).json({ error: 'Token does not have admin access' });
      }
      req.auth = payload;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  const cookies = parseCookies(req);
  const session = verify(cookies[SESSION_COOKIE]);
  if (!session) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  req.auth = session;
  next();
}

module.exports = { startLogin, handleCallback, checkEntraLogin, requireAdminAuth };
