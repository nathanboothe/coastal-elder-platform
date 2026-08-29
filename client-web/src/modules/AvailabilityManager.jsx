import { useEffect, useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKS = ['Every Week', '1st', '2nd', '3rd', '4th', '5th'];
const SLOTS = [
  '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
  '9:30 PM', '10:00 PM',
];
// Matches the fixed choice list on the WACCodes table's Campus field.
// Admins are signed in via the manage-session cookie, which doesn't grant
// access to the scheduler-session-gated /campuses endpoint (different
// auth systems), so this is hardcoded rather than fetched — same
// tradeoff made on the Android admin app.
const CAMPUSES = [
  'Battery Park', 'Bethany Campus', 'Chesapeake', 'Gloucester',
  'Hampton', 'Mathews', 'Williamsburg', 'Yorktown',
];

// No routing library in this app by design (see App.jsx) — this local
// enum plus useState drives the menu/drill-down navigation the same way.
const VIEW = {
  MENU: 'menu',
  WAC_CODES: 'wac_codes',
  ELDERS: 'elders',
};

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      className={`toggle-chip${checked ? ' toggle-chip-active' : ''}`}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  );
}

export default function AvailabilityManager() {
  // --- Session ---
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState(null);
  const [myName, setMyName] = useState(null);
  const [myElderName, setMyElderName] = useState(null);
  const [authError, setAuthError] = useState(null);

  // --- Menu / navigation ---
  const [view, setView] = useState(VIEW.MENU);

  // --- Elder availability / time off ---
  const [elders, setElders] = useState([]);
  const [selectedElder, setSelectedElder] = useState('');
  const [availability, setAvailability] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null); // dry-run preview or applied result
  const [backfillError, setBackfillError] = useState(null);

  const [newDay, setNewDay] = useState('Sunday');
  const [newWeeks, setNewWeeks] = useState([]);
  const [newSlots, setNewSlots] = useState([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // --- WAC codes (admin only) ---
  const [wacCodes, setWacCodes] = useState([]);
  const [wacLoading, setWacLoading] = useState(false);
  const [wacError, setWacError] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [newCampus, setNewCampus] = useState('');
  const [newClassDate, setNewClassDate] = useState('');
  const [creatingCode, setCreatingCode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setAuthError(err);
      window.history.replaceState({}, '', '/manage');
    }

    api('/auth/me')
      .then((data) => {
        setSignedIn(true);
        setRole(data.role);
        setMyName(data.name);
        setMyElderName(data.elderName);
        // Elders have exactly one place to go — skip the menu entirely.
        if (data.role === 'elder') {
          setView(VIEW.ELDERS);
        }
      })
      .catch(() => setSignedIn(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    if (role === 'admin' && view === VIEW.ELDERS) {
      api('/all-elders').then(setElders).catch((e) => setError(e.message));
    } else if (role === 'admin' && view === VIEW.WAC_CODES) {
      loadWacCodes();
    } else if (role === 'elder' && view === VIEW.ELDERS) {
      if (myElderName) {
        loadElderData(myElderName);
      } else {
        setError('No elder record matches your signed-in account. Contact an administrator.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, role, view, myElderName]);

  function loadElderData(elderName) {
    setSelectedElder(elderName);
    setError(null);
    if (!elderName) {
      setAvailability([]);
      setTimeOff([]);
      return;
    }
    setLoading(true);
    Promise.all([
      api(`/elder-availability?elderName=${encodeURIComponent(elderName)}`),
      api(`/elder-timeoff?elderName=${encodeURIComponent(elderName)}`),
    ])
      .then(([avail, off]) => {
        setAvailability(avail);
        setTimeOff(off);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function refreshFromM365() {
    setSyncLoading(true);
    setSyncError(null);
    setSyncSummary(null);
    api('/elder-sync/refresh', { method: 'POST' })
      .then((summary) => {
        setSyncSummary(summary);
        return api('/all-elders').then(setElders);
      })
      .catch((e) => setSyncError(e.message))
      .finally(() => setSyncLoading(false));
  }

  function runObjectIdBackfill(confirm) {
    setBackfillLoading(true);
    setBackfillError(null);
    if (confirm) setBackfillResult(null); // clear the dry-run preview once we commit
    api('/elder-sync/backfill-object-ids', { method: 'POST', body: JSON.stringify({ confirm }) })
      .then((result) => {
        setBackfillResult(result);
        if (confirm) return api('/all-elders').then(setElders);
      })
      .catch((e) => setBackfillError(e.message))
      .finally(() => setBackfillLoading(false));
  }

  function toggleInArray(arr, setArr, value) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function addAvailability(ev) {
    ev.preventDefault();
    if (newWeeks.length === 0 || newSlots.length === 0) {
      setError('Pick at least one week and one time slot.');
      return;
    }
    setLoading(true);
    setError(null);
    api('/elder-availability', {
      method: 'POST',
      body: JSON.stringify({
        elderName: selectedElder,
        dayOfWeek: newDay,
        weekOfMonth: newWeeks,
        timeSlots: newSlots,
      }),
    })
      .then(() => {
        setNewWeeks([]);
        setNewSlots([]);
        return loadElderData(selectedElder);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function deleteAvailability(id) {
    setLoading(true);
    api(`/elder-availability/${id}`, { method: 'DELETE' })
      .then(() => loadElderData(selectedElder))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function addTimeOff(ev) {
    ev.preventDefault();
    if (!startDate || !endDate) {
      setError('Start and end date are required.');
      return;
    }
    setLoading(true);
    setError(null);
    api('/elder-timeoff', {
      method: 'POST',
      body: JSON.stringify({ elderName: selectedElder, startDate, endDate, notes }),
    })
      .then(() => {
        setStartDate('');
        setEndDate('');
        setNotes('');
        return loadElderData(selectedElder);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function deleteTimeOff(id) {
    setLoading(true);
    api(`/elder-timeoff/${id}`, { method: 'DELETE' })
      .then(() => loadElderData(selectedElder))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadWacCodes() {
    setWacLoading(true);
    setWacError(null);
    api('/wac-codes')
      .then(setWacCodes)
      .catch((e) => setWacError(e.message))
      .finally(() => setWacLoading(false));
  }

  function createWacCode(ev) {
    ev.preventDefault();
    if (!newCode.trim() || !newCampus || !newClassDate) {
      setWacError('Code, campus, and class date are all required.');
      return;
    }
    setCreatingCode(true);
    setWacError(null);
    api('/wac-codes', {
      method: 'POST',
      body: JSON.stringify({ code: newCode.trim(), campusName: newCampus, classDate: newClassDate }),
    })
      .then(() => {
        setNewCode('');
        setNewCampus('');
        setNewClassDate('');
        loadWacCodes();
      })
      .catch((e) => setWacError(e.message))
      .finally(() => setCreatingCode(false));
  }

  function deactivateWacCode(id) {
    setWacError(null);
    api(`/wac-codes/${id}`, { method: 'DELETE' })
      .then(loadWacCodes)
      .catch((e) => setWacError(e.message));
  }

  function backToMenu() {
    setView(VIEW.MENU);
    setError(null);
    setSelectedElder('');
    setAvailability([]);
    setTimeOff([]);
  }

  if (checkingSession) {
    return (
      <div className="wizard">
        <img src="/logo.png" alt="Coastal Church" className="logo-img" />
        <p className="loading-message">Loading…</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="wizard">
        <img src="/logo.png" alt="Coastal Church" className="logo-img" />
        <h1>Elder Scheduling — Manage Availability</h1>
        <p className="empty-message">Sign in with your Coastal Microsoft account to continue.</p>

        {authError && <p className="error-message">{authError}</p>}

        <div className="option-grid">
          <a
            href="/api/auth/login"
            className="option-btn"
            style={{ display: 'flex', textDecoration: 'none' }}
          >
            Sign in with Microsoft
          </a>
        </div>

        <a href="/" className="restart-btn" style={{ display: 'inline-block', marginTop: '2rem' }}>
          ← Back to scheduling
        </a>
      </div>
    );
  }

  // --- Menu (admin only — elders skip straight to VIEW.ELDERS at sign-in) ---
  if (view === VIEW.MENU) {
    return (
      <div className="wizard">
        <img src="/logo.png" alt="Coastal Church" className="logo-img" />
        <h1>Elder Scheduling — Manage Availability</h1>
        <p className="empty-message">Signed in as {myName}.</p>

        <div className="option-grid">
          <button className="option-btn" onClick={() => setView(VIEW.WAC_CODES)}>
            We Are Coastal Codes
          </button>
          <button className="option-btn" onClick={() => setView(VIEW.ELDERS)}>
            Elder Availability & Time Off
          </button>
        </div>

        <a href="/" className="restart-btn" style={{ display: 'inline-block', marginTop: '2rem' }}>
          ← Back to scheduling
        </a>
      </div>
    );
  }

  // --- WAC Codes view (admin only) ---
  if (view === VIEW.WAC_CODES) {
    return (
      <div className="wizard">
        <img src="/logo.png" alt="Coastal Church" className="logo-img" />
        <button className="restart-btn" onClick={backToMenu} style={{ marginBottom: '1rem' }}>
          ← Back to menu
        </button>
        <h1>We Are Coastal Codes</h1>

        {wacLoading && <p className="loading-message">Loading…</p>}
        {wacError && <p className="error-message">{wacError}</p>}

        {!wacLoading &&
          wacCodes
            .filter((c) => c.active)
            .map((c) => (
              <div className="manager-row" key={c.id}>
                <div>
                  <strong>{c.code}</strong> — {c.campus} · {c.classDate}
                </div>
                <button className="delete-btn" onClick={() => deactivateWacCode(c.id)}>
                  Deactivate
                </button>
              </div>
            ))}

        <form className="member-form" onSubmit={createWacCode} style={{ marginTop: '1rem' }}>
          <h3>Create a code</h3>
          <label>
            Code
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. AUG2026" />
          </label>
          <label>
            Campus
            <select value={newCampus} onChange={(e) => setNewCampus(e.target.value)}>
              <option value="">— Select a campus —</option>
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class date
            <input type="date" value={newClassDate} onChange={(e) => setNewClassDate(e.target.value)} />
          </label>
          <button type="submit" disabled={creatingCode}>
            {creatingCode ? 'Creating…' : 'Create code'}
          </button>
        </form>
      </div>
    );
  }

  // --- Elder Availability & Time Off view (both roles) ---
  return (
    <div className="wizard">
      <img src="/logo.png" alt="Coastal Church" className="logo-img" />
      {role === 'admin' && (
        <button className="restart-btn" onClick={backToMenu} style={{ marginBottom: '1rem' }}>
          ← Back to menu
        </button>
      )}
      <h1>{role === 'admin' ? 'Elder Availability & Time Off' : 'My Availability & Time Off'}</h1>

      {role === 'admin' && (
        <>
          <section className="manager-section">
            <h2>Elder roster (M365)</h2>
            <p className="empty-message">
              Syncs elders from Coastal's three elder groups in M365. Elders added manually (like
              Demo) aren't affected.
            </p>
            <button type="button" onClick={refreshFromM365} disabled={syncLoading}>
              {syncLoading ? 'Refreshing…' : 'Refresh from M365'}
            </button>

            {syncError && <p className="error-message">{syncError}</p>}

            {syncSummary && (
              <div className="manager-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div>✅ Added: {syncSummary.added.length ? syncSummary.added.join(', ') : 'none'}</div>
                <div>🔄 Updated: {syncSummary.updated.length ? syncSummary.updated.join(', ') : 'none'}</div>
                <div>
                  ↩️ Reactivated: {syncSummary.reactivated.length ? syncSummary.reactivated.join(', ') : 'none'}
                </div>
                <div>
                  🚫 Marked inactive:{' '}
                  {syncSummary.deactivated.length ? syncSummary.deactivated.join(', ') : 'none'}
                </div>
                {syncSummary.skipped.length > 0 && (
                  <div>
                    ⚠️ Skipped: {syncSummary.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
                  </div>
                )}
                {syncSummary.cancelledAppointments.length > 0 && (
                  <div>
                    📧 {syncSummary.cancelledAppointments.length} future appointment(s) were cancelled
                    and reported to the OME email.
                  </div>
                )}
                {syncSummary.duplicates && syncSummary.duplicates.length > 0 && (
                  <div>
                    ⚠️ {syncSummary.duplicates.length} elder(s) found in more than one elder group —
                    reported to the OME email for cleanup in M365.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="manager-section">
            <h2>Backfill M365 Object IDs</h2>
            <p className="empty-message">
              One-time fix for elders added manually (not via M365 group sync) who are missing the
              M365 Object ID the calendar-sync feature needs. Matches each one to their M365 account
              by exact email match — this does NOT touch the M365 group roster or create any new
              elder records. Run this once before relying on calendar sync for existing elders.
            </p>
            <button type="button" onClick={() => runObjectIdBackfill(false)} disabled={backfillLoading}>
              {backfillLoading ? 'Checking…' : 'Preview backfill (no changes)'}
            </button>

            {backfillError && <p className="error-message">{backfillError}</p>}

            {backfillResult && (
              <div className="manager-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div>
                  {backfillResult.applied ? '✅ Applied' : '👀 Preview only — nothing written yet'}
                </div>
                <div>
                  ✅ {backfillResult.applied ? 'Updated' : 'Would update'}:{' '}
                  {backfillResult.matched.length
                    ? backfillResult.matched.map((m) => m.elderName).join(', ')
                    : 'none'}
                </div>
                {backfillResult.nearMisses.length > 0 && (
                  <div>
                    ⚠️ Near-misses needing manual review (email doesn't match exactly — check for a
                    typo or trailing space):{' '}
                    {backfillResult.nearMisses
                      .map((n) => `${n.elderName} (Airtable: ${n.elderEmail} vs M365: ${n.graphEmail})`)
                      .join('; ')}
                  </div>
                )}
                {backfillResult.noMatch.length > 0 && (
                  <div>
                    ❌ No M365 account found: {backfillResult.noMatch.map((n) => n.elderName).join(', ')}
                  </div>
                )}
                {!backfillResult.applied && backfillResult.matched.length > 0 && (
                  <button type="button" onClick={() => runObjectIdBackfill(true)} disabled={backfillLoading}>
                    {backfillLoading
                      ? 'Applying…'
                      : `Apply — write Object ID for ${backfillResult.matched.length} elder(s)`}
                  </button>
                )}
              </div>
            )}
          </section>

          <label className="elder-select-label">
            Elder
            <select
              value={selectedElder}
              onChange={(e) => loadElderData(e.target.value)}
              className="elder-select"
            >
              <option value="">— Select an elder —</option>
              {elders.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name} ({e.campus})
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="loading-message">Loading…</p>}

      {selectedElder && !loading && (
        <>
          <section className="manager-section">
            <h2>Current weekly availability</h2>
            {availability.length === 0 && <p className="empty-message">No availability set yet.</p>}
            {availability.map((row) => (
              <div className="manager-row" key={row.id}>
                <div>
                  <strong>{row['Day of Week']}</strong>
                  {' — '}
                  {(row['Week of Month'] || []).join(', ')}
                  <br />
                  <span className="empty-message">{(row['Time Slots'] || []).join(', ')}</span>
                </div>
                <button className="delete-btn" onClick={() => deleteAvailability(row.id)}>
                  Remove
                </button>
              </div>
            ))}

            <form className="member-form" onSubmit={addAvailability} style={{ marginTop: '1rem' }}>
              <h3>Add availability</h3>
              <label>
                Day of week
                <select value={newDay} onChange={(e) => setNewDay(e.target.value)}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <span className="empty-message">Which weeks of the month?</span>
              <div className="chip-row">
                {WEEKS.map((w) => (
                  <Toggle
                    key={w}
                    label={w}
                    checked={newWeeks.includes(w)}
                    onChange={() => toggleInArray(newWeeks, setNewWeeks, w)}
                  />
                ))}
              </div>

              <span className="empty-message">Which times?</span>
              <div className="chip-row">
                {SLOTS.map((s) => (
                  <Toggle
                    key={s}
                    label={s}
                    checked={newSlots.includes(s)}
                    onChange={() => toggleInArray(newSlots, setNewSlots, s)}
                  />
                ))}
              </div>

              <button type="submit">Add availability</button>
            </form>
          </section>

          <section className="manager-section">
            <h2>Time off</h2>
            {timeOff.length === 0 && <p className="empty-message">No time off scheduled.</p>}
            {timeOff.map((row) => (
              <div className="manager-row" key={row.id}>
                <div>
                  <strong>
                    {row['Start Date']} → {row['End Date']}
                  </strong>
                  {row['Notes'] && <div className="empty-message">{row['Notes']}</div>}
                </div>
                <button className="delete-btn" onClick={() => deleteTimeOff(row.id)}>
                  Remove
                </button>
              </div>
            ))}

            <form className="member-form" onSubmit={addTimeOff} style={{ marginTop: '1rem' }}>
              <h3>Add time off</h3>
              <label>
                Start date
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label>
                Notes (optional)
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <button type="submit">Add time off</button>
            </form>
          </section>
        </>
      )}

      <a href="/" className="restart-btn" style={{ display: 'inline-block', marginTop: '2rem' }}>
        ← Back to scheduling
      </a>
    </div>
  );
}
