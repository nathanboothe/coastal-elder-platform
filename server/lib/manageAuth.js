// server/lib/manageAuth.js
// Elder/Admin sign-in via Microsoft Entra ID — Authorization Code flow,
// confidential client (this server holds a client secret, unlike the
// mobile app's public client, so PKCE isn't required here; CSRF is still
// mitigated via the `state` parameter below). Replaces the old single
// shared PIN with real per-person sign-in, and determines a hybrid role:
//   - 'admin' (elder-app-admins group): can manage any elder's
//     availability/time off, and manage WAC codes.
//   - 'elder' (elders group): scoped to their own record, matched by
//     signed-in email against the Elders table.
//
// Same signed-cookie session mechanism as before (crypto HMAC) — only the
// login mechanism and the payload it stores have changed.

const crypto = require('crypto');
const config = require('../config');
const entraAuth = require('./entraAuth');
const { listRecords } = require('./airtable');

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

/** Step 1: redirect the browser to Microsoft's sign-in page. Called by
 *  navigating to this URL directly (a real link, not a fetch call) —
 *  the OAuth redirect needs a top-level browser navigation. */
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

/** Step 2: Microsoft redirects back here with a code (or an error). */
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
    const payload = await entraAuth.verifyEntraToken(tokenData.id_token);

    if (!payload.groups) {
      return res.redirect(
        '/manage?error=' +
          encodeURIComponent('Could not determine group membership. Contact an administrator.')
      );
    }

    const isAdminGroup = payload.groups.includes(config.entra.adminGroupId);
    const isElderGroup = payload.groups.includes(config.entra.elderGroupId);
    if (!isAdminGroup && !isElderGroup) {
      return res.redirect(
        '/manage?error=' + encodeURIComponent('Your account is not authorized for admin access.')
      );
    }

    const role = isAdminGroup ? 'admin' : 'elder';
    const email = payload.email || payload.preferred_username || '';

    let elderName = null;
    if (email) {
      try {
        const matches = await listRecords(config.airtable.tables.elders, {
          filterByFormula: `LOWER({Email}) = '${email.toLowerCase().replace(/'/g, "\\'")}'`,
        });
        if (matches[0]) elderName = matches[0].fields['Full Name'];
      } catch (err) {
        console.error('Elder lookup by email failed during login:', err.message || err);
        // Non-fatal — sign-in still succeeds, just without a matched
        // elder record (self-service screens will show a clear message).
      }
    }

    const session = sign({
      role,
      name: payload.name,
      email,
      elderName,
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

/** Express middleware — blocks the request unless a valid session cookie is present. */
function requireManageAuth(req, res, next) {
  const cookies = parseCookies(req);
  const session = verify(cookies[SESSION_COOKIE]);
  if (!session) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  req.auth = session;
  next();
}

module.exports = { startLogin, handleCallback, requireManageAuth };
