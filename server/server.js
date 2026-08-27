// server.js
// Entry point. Single Express app, single chokepoint, per the framework.
// Serves both the web client's built static files AND the API that the
// mobile app calls remotely — now that the two backends are merged.

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const elderSchedulingRoutes = require('./routes/elderScheduling');

const app = express();

// CORS: needed for the mobile app's cross-origin API calls. Worth being
// honest about what this does and doesn't protect: CORS is enforced by
// browsers, not by native app HTTP clients, so it does nothing to
// restrict the Expo app itself — a native fetch call ignores it entirely.
// What it DOES protect against is some other website's JavaScript making
// browser-based requests to this API using a signed-in user's cookies.
// CORS_ALLOWED_ORIGINS is a comma-separated env var so this can be
// tightened per environment without a code change; defaults to none
// (same-origin only) if unset, since the web client is served by this
// same app and doesn't need CORS at all.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  })
);

app.use(express.json());

// API routes for this module.
app.use('/api', elderSchedulingRoutes);

// Serve the built React frontend as static assets. This repo's web
// client folder is named `client-web`, not `client` — already fixed on
// this branch per Step 13.1 of the consolidation runbook.
const clientBuildPath = path.join(__dirname, '..', 'client-web', 'dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) res.status(200).send('Elder Scheduling backend is running. Frontend not built yet.');
  });
});

// Basic error handler - logs server-side, returns a generic message to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Elder Scheduling server listening on port ${config.port}`);
});
