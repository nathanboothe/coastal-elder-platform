import { useEffect, useState } from 'react';

// Sunday-first, matching DAY_NAMES (server/lib/availability.js) and DAYS
// (AvailabilityManager.jsx) elsewhere in this app — and how Coastal's own
// audience expects a US calendar to read, Sunday being the day that
// matters most here.
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Builds a Sun-Sat grid of Date objects covering the given month, padded
 *  with the trailing days of the prior/next month so every week is a full
 *  row of 7 (the usual month-calendar layout). */
function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);

  // getDay(): 0=Sunday..6=Saturday — already the order we want, no shift.
  const leadingBlank = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - leadingBlank);

  const totalCells = Math.ceil((leadingBlank + last.getDate()) / 7) * 7;
  const cells = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < totalCells; i++) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

/**
 * Calendly-style calendar: month grid on top, that day's open half-hour
 * slots shown inline underneath once a day is picked. This is the visual
 * layer on top of the existing "availability window" concept
 * (GET /api/elder-availability-window) — one call per visible month
 * returns every open day AND its times together, so clicking a day is
 * instant (no second network round-trip), the same "fetch once, compute
 * in memory" approach getAvailabilityWindow already uses server-side.
 *
 * Props:
 *  - campusName, classDate, elderName: same values the window endpoint
 *    already takes.
 *  - refreshToken: bump this (any changing value) to force a re-fetch of
 *    the currently visible month — used after a booking conflict, so a
 *    slot someone else just took disappears from the grid.
 *  - onPickTime(dateStr, timeStr): called once the member picks a time.
 *  - onChooseDifferentElder(): "none of these work — go back to the elder
 *    list" escape hatch.
 *  - onNothingWorks(): "none of these work for me at all" escape hatch,
 *    wired to the engagement-request flow.
 */
export default function Calendar({
  campusName,
  classDate,
  elderName,
  refreshToken,
  onPickTime,
  onChooseDifferentElder,
  onNothingWorks,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [windowByDate, setWindowByDate] = useState(new Map());
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setLoadingMonth(true);
    setError(null);
    setSelectedDate(null);

    const rangeStart = startOfMonth(visibleMonth);
    const rangeEnd = endOfMonth(visibleMonth);

    const params = new URLSearchParams({
      campusName,
      classDate,
      elderName,
      startDate: isoDate(rangeStart),
      endDate: isoDate(rangeEnd),
    });

    api(`/elder-availability-window?${params.toString()}`)
      .then((days) => {
        const map = new Map();
        for (const d of days) map.set(d.date, d.times);
        setWindowByDate(map);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMonth(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth, campusName, classDate, elderName, refreshToken]);

  function pickDay(day) {
    const dateStr = isoDate(day);
    if (!windowByDate.has(dateStr)) return;
    setSelectedDate(dateStr);
  }

  function changeMonth(delta) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    setVisibleMonth(next);
  }

  const cells = buildMonthGrid(visibleMonth);
  const canGoBack = !isSameMonth(visibleMonth, today);
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedTimes = selectedDate ? windowByDate.get(selectedDate) || [] : [];

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => changeMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button type="button" className="calendar-nav-btn" onClick={() => changeMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}

        {loadingMonth
          ? Array.from({ length: cells.length }).map((_, i) => <div key={i} className="calendar-day calendar-day-loading" />)
          : cells.map((day, i) => {
              const dateStr = isoDate(day);
              const inMonth = isSameMonth(day, visibleMonth);
              const isPast = day < today;
              const isOpen = inMonth && !isPast && windowByDate.has(dateStr);
              const isSelected = dateStr === selectedDate;
              const classes = ['calendar-day'];
              if (!inMonth) classes.push('calendar-day-outside');
              if (isOpen) classes.push('calendar-day-open');
              if (isSelected) classes.push('calendar-day-selected');
              return (
                <button
                  key={i}
                  type="button"
                  className={classes.join(' ')}
                  disabled={!isOpen}
                  onClick={() => pickDay(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
      </div>

      {!loadingMonth && windowByDate.size === 0 && (
        <p className="empty-message" style={{ marginTop: '1rem' }}>
          No open times this month for {elderName}. Try another month, or use the options below.
        </p>
      )}

      {selectedDate && (
        <div className="calendar-times">
          <h3>
            Available times —{' '}
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          <div className="option-grid calendar-time-grid">
            {selectedTimes.map((t) => (
              <button key={t} className="option-btn" onClick={() => onPickTime(selectedDate, t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="restart-btn" onClick={onChooseDifferentElder}>
          None of these work — choose a different elder
        </button>
        <button type="button" className="restart-btn" onClick={onNothingWorks}>
          None of these work for me
        </button>
      </div>
    </div>
  );
}
