// config.js
// GITIGNORED IN PRINCIPLE — but since this project deploys to Render (not a
// self-hosted Windows Service), actual secret values live in Render's
// Environment Variables dashboard, not in a local file at all. This module
// just reads them from process.env and fails loudly if something's missing.
//
// Set these in Render: Dashboard -> your service -> Environment.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  // --- Airtable ---
  airtable: {
    apiKey: required('AIRTABLE_API_KEY'),       // Personal access token, scoped to this base only
    baseId: required('AIRTABLE_BASE_ID'),        // app3N5PBKrcbX0kBu (the "Elder Scheduling" base)
    tables: {
      campuses: 'Campuses',
      elders: 'Elders',
      availability: 'Availability',
      timeOff: 'TimeOff',
      appointments: 'Appointments',
      sundayOptOut: 'SundayOptOut',
      // Shared with elder-android-backend — same underlying table, this
      // repo just references it by name instead of table ID.
      wacCodes: 'WACCodes',
    },
  },

  // --- Microsoft Graph (email via OAuth client credentials, not SMTP) ---
  graph: {
    tenantId: required('GRAPH_TENANT_ID'),
    clientId: required('GRAPH_CLIENT_ID'),
    clientSecret: required('GRAPH_CLIENT_SECRET'),
    sendAsMailbox: process.env.GRAPH_SEND_AS_MAILBOX || 'scheduling@gocoastal.org',
    elderGroupNames: [
      process.env.GRAPH_ELDER_GROUP_NAME_1 || 'Elder Group 1',
      process.env.GRAPH_ELDER_GROUP_NAME_2 || 'Elder Group 2',
      process.env.GRAPH_ELDER_GROUP_NAME_3 || 'Elder Group 3',
    ],
  },

  // --- Notification recipients ---
  notifications: {
    omeEmail: process.env.OME_EMAIL || 'engagement@gocoastal.org',
  },

  // --- Manage page (elder/admin sign-in) session cookie signing.
  // MANAGE_PIN is gone — replaced by Entra ID sign-in (see `entra` below).
  manage: {
    sessionSecret: required('MANAGE_SESSION_SECRET'),
  },

  // --- Member wizard session cookie signing. SCHEDULER_PIN is gone —
  // replaced by per-class WAC codes (see lib/wacCodes.js). ---
  scheduler: {
    sessionSecret: required('SCHEDULER_SESSION_SECRET'),
  },

  // --- Mobile bearer-token signing. The web client uses signed cookies
  // (manage.sessionSecret / scheduler.sessionSecret above); the mobile
  // app can't rely on a browser cookie jar, so it gets a JWT instead.
  // One secret, `scope` field on the token payload ('scheduler' vs
  // 'admin') tells requireSchedulerAuth/requireAdminAuth which kind it
  // is — same approach elder-android-backend used on its own before the
  // backend merge. ---
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: '12h',
  },

  // --- Entra ID (elder/admin sign-in) ---
  // A separate app registration from BOTH the Graph mail registration
  // above AND elder-android-app's mobile public client — confidential
  // client, Authorization Code flow, since this server can hold a secret.
  entra: {
    tenantId: required('ENTRA_TENANT_ID'),
    clientId: required('ENTRA_CLIENT_ID'),
    clientSecret: required('ENTRA_CLIENT_SECRET'),
    redirectUri: process.env.ENTRA_REDIRECT_URI || 'https://elder.techfoundry360.com/api/auth/callback',
    // Same two security groups the Android app uses — group membership is
    // a tenant-level concept, shared across app registrations.
    elderGroupId: required('ENTRA_GROUP_ID_ELDERS'),
    adminGroupId: required('ENTRA_GROUP_ID_ADMINS'),
  },

  // --- Scheduling behavior ---
  scheduling: {
    weeksAhead: 8,
    timeZone: 'America/New_York',
  },

  port: process.env.PORT || 3000,
};
