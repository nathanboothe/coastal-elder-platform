import { useEffect, useRef, useState } from 'react';

// Same fixed lists AvailabilityManager.jsx already uses for the underlying
// Airtable fields — duplicated here rather than shared, matching this
// project's existing per-module convention (see e.g. SLOT_ORDER being
// duplicated between server/lib/availability.js and AvailabilityManager.jsx
// already).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREV = { Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const SLOTS = [
  '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
  '9:30 PM', '10:00 PM',
];
const WEEKS = ['Every Week', '1st', '2nd', '3rd', '4th', '5th'];

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

/** Builds { [day]: { rowId, slots: Set } } from availability rows whose
 *  Week of Month is exactly ['Every Week'] — the only shape a flat weekly
 *  grid can represent honestly. Rows with anything else (e.g. "1st, 3rd"
 *  only) are left for the Advanced section below instead. */
function buildGridState(rows) {
  const state = {};
  for (const day of DAYS) state[day] = { rowId: null, slots: new Set() };
  for (const row of rows) {
    const weeks = row['Week of Month'] || [];
    const isSimpleEveryWeek = weeks.length === 1 && weeks[0] === 'Every Week';
    if (!isSimpleEveryWeek) continue;
    const day = row['Day of Week'];
    if (!DAYS.includes(day)) continue;
    state[day] = { rowId: row.id, slots: new Set(row['Time Slots'] || []) };
  }
  return state;
}

/**
 * Calendly-style weekly availability grid: rows are the fixed half-hour
 * slots, columns are days of the week. Click a cell to toggle it; click and
 * drag down a column to paint/clear a block in one motion — the "block of
 * time" editing model Nathan asked for, instead of a day dropdown plus a
 * flat list of checkboxes one at a time.
 *
 * Same underlying data model as before (Day of Week / Week of Month / Time
 * Slots on the Availability table, same GET/POST/DELETE endpoints) — this
 * only changes how it's edited. Elders/admins with a specific-week pattern
 * (e.g. "1st and 3rd Sunday only") aren't representable in a flat weekly
 * grid, so those rows are listed separately in an Advanced section using
 * the original day/week/slot picker, so that data is never silently
 * dropped or overwritten.
 */
export default function AvailabilityGrid({ elderName, availability, onChanged }) {
  const [grid, setGrid] = useState(() => buildGridState(availability));
  const [dirtyDays, setDirtyDays] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dragRef = useRef(null); // { day, value } while a drag is in progress

  useEffect(() => {
    setGrid(buildGridState(availability));
    setDirtyDays(new Set());
  }, [availability]);

  useEffect(() => {
    function endDrag() {
      dragRef.current = null;
    }
    window.addEventListener('mouseup', endDrag);
    return () => window.removeEventListener('mouseup', endDrag);
  }, []);

  function isSelected(day, slot) {
    return grid[day].slots.has(slot);
  }

  function paintCell(day, slot, value) {
    setGrid((prev) => {
      const daySlots = new Set(prev[day].slots);
      if (value) daySlots.add(slot);
      else daySlots.delete(slot);
      return { ...prev, [day]: { ...prev[day], slots: daySlots } };
    });
    setDirtyDays((prev) => new Set(prev).add(day));
  }

  function handleMouseDown(day, slot) {
    const value = !isSelected(day, slot);
    dragRef.current = { day, value };
    paintCell(day, slot, value);
  }

  function handleMouseEnter(day, slot) {
    const drag = dragRef.current;
    if (!drag || drag.day !== day) return;
    paintCell(day, slot, drag.value);
  }

  function clearDay(day) {
    setGrid((prev) => ({ ...prev, [day]: { ...prev[day], slots: new Set() } }));
    setDirtyDays((prev) => new Set(prev).add(day));
  }

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      for (const day of dirtyDays) {
        const { rowId, slots } = grid[day];
        // Replace-in-place: delete the old "Every Week" row for this day
        // (if any) and create a fresh one with the new slot set — the
        // existing endpoints don't support a partial update, and this
        // mirrors how the original chip-based form already worked (add a
        // new row per submission).
        if (rowId) {
          await api(`/elder-availability/${rowId}`, { method: 'DELETE' });
        }
        if (slots.size > 0) {
          await api('/elder-availability', {
            method: 'POST',
            body: JSON.stringify({
              elderName,
              dayOfWeek: day,
              weekOfMonth: ['Every Week'],
              timeSlots: Array.from(slots),
            }),
          });
        }
      }
      setDirtyDays(new Set());
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Advanced: rows with a specific-week pattern, not representable in
  // the flat grid above. Kept as the original add/remove form so nothing
  // gets silently dropped. ---
  const advancedRows = availability.filter((row) => {
    const weeks = row['Week of Month'] || [];
    return !(weeks.length === 1 && weeks[0] === 'Every Week');
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newDay, setNewDay] = useState('Sunday');
  const [newWeeks, setNewWeeks] = useState([]);
  const [newSlots, setNewSlots] = useState([]);
  const [advancedError, setAdvancedError] = useState(null);
  const [advancedSaving, setAdvancedSaving] = useState(false);

  function toggleInArray(arr, setArr, value) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function addAdvancedAvailability(ev) {
    ev.preventDefault();
    if (newWeeks.length === 0 || newSlots.length === 0) {
      setAdvancedError('Pick at least one week and one time slot.');
      return;
    }
    setAdvancedSaving(true);
    setAdvancedError(null);
    api('/elder-availability', {
      method: 'POST',
      body: JSON.stringify({ elderName, dayOfWeek: newDay, weekOfMonth: newWeeks, timeSlots: newSlots }),
    })
      .then(() => {
        setNewWeeks([]);
        setNewSlots([]);
        onChanged();
      })
      .catch((e) => setAdvancedError(e.message))
      .finally(() => setAdvancedSaving(false));
  }

  function deleteAdvancedRow(id) {
    api(`/elder-availability/${id}`, { method: 'DELETE' })
      .then(onChanged)
      .catch((e) => setAdvancedError(e.message));
  }

  return (
    <div className="availability-grid-wrap">
      {error && <p className="error-message">{error}</p>}

      <div className="availability-grid" onMouseLeave={() => (dragRef.current = null)}>
        <div className="availability-grid-corner" />
        {DAYS.map((day) => (
          <div key={day} className="availability-grid-day-header">
            {DAY_ABBREV[day]}
            {dirtyDays.has(day) && <span className="availability-grid-dirty-dot" title="Unsaved changes" />}
          </div>
        ))}

        {SLOTS.map((slot) => (
          <FragmentRow key={slot} slot={slot} days={DAYS} isSelected={isSelected} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} />
        ))}
      </div>

      <div className="availability-grid-actions">
        {DAYS.map(
          (day) =>
            grid[day].slots.size > 0 && (
              <button key={day} type="button" className="delete-btn" onClick={() => clearDay(day)}>
                Clear {DAY_ABBREV[day]}
              </button>
            )
        )}
      </div>

      <button type="button" onClick={saveChanges} disabled={saving || dirtyDays.size === 0} style={{ marginTop: '0.75rem' }}>
        {saving ? 'Saving…' : dirtyDays.size > 0 ? `Save changes (${dirtyDays.size} day${dirtyDays.size > 1 ? 's' : ''})` : 'Saved'}
      </button>

      <section style={{ marginTop: '2rem' }}>
        <button type="button" className="restart-btn" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▾' : '▸'} Advanced — specific weeks (e.g. 1st &amp; 3rd Sunday only)
          {advancedRows.length > 0 ? ` (${advancedRows.length})` : ''}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '1rem' }}>
            <p className="empty-message">
              These don't fit the weekly grid above because they only apply on specific weeks of the month. Manage
              them here the same way as before.
            </p>

            {advancedRows.map((row) => (
              <div className="manager-row" key={row.id}>
                <div>
                  <strong>{row['Day of Week']}</strong>
                  {' — '}
                  {(row['Week of Month'] || []).join(', ')}
                  <br />
                  <span className="empty-message">{(row['Time Slots'] || []).join(', ')}</span>
                </div>
                <button className="delete-btn" onClick={() => deleteAdvancedRow(row.id)}>
                  Remove
                </button>
              </div>
            ))}

            {advancedError && <p className="error-message">{advancedError}</p>}

            <form className="member-form" onSubmit={addAdvancedAvailability} style={{ marginTop: '1rem' }}>
              <h3>Add a specific-week pattern</h3>
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
                  <Toggle key={w} label={w} checked={newWeeks.includes(w)} onChange={() => toggleInArray(newWeeks, setNewWeeks, w)} />
                ))}
              </div>

              <span className="empty-message">Which times?</span>
              <div className="chip-row">
                {SLOTS.map((s) => (
                  <Toggle key={s} label={s} checked={newSlots.includes(s)} onChange={() => toggleInArray(newSlots, setNewSlots, s)} />
                ))}
              </div>

              <button type="submit" disabled={advancedSaving}>
                {advancedSaving ? 'Adding…' : 'Add'}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

// Small helper so the row of 7 day-cells for one slot can be produced
// without repeating the day-loop and event wiring inline above.
function FragmentRow({ slot, days, isSelected, onMouseDown, onMouseEnter }) {
  return (
    <>
      <div className="availability-grid-slot-label">{slot}</div>
      {days.map((day) => {
        const selected = isSelected(day, slot);
        return (
          <div
            key={day}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${day} ${slot}`}
            className={`availability-grid-cell${selected ? ' availability-grid-cell-selected' : ''}`}
            onMouseDown={(ev) => {
              ev.preventDefault(); // avoid text-selection while dragging
              onMouseDown(day, slot);
            }}
            onMouseEnter={() => onMouseEnter(day, slot)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onMouseDown(day, slot);
              }
            }}
          />
        );
      })}
    </>
  );
}
