import { useState } from 'react';

const STEP = {
  CODE_GATE: 'code_gate',
  PREFERENCE: 'preference',
  ELDER_LIST: 'elder_list',
  ENGAGEMENT_FORM: 'engagement_form',
  ENGAGEMENT_DONE: 'engagement_done',
  WINDOW: 'window', // the "next two weeks" combined date+time view
  MEMBER_FORM: 'member_form',
  CONFIRMED: 'confirmed',
};

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function formatDateLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function ElderScheduling() {
  const [step, setStep] = useState(STEP.CODE_GATE);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);

  // Derived entirely from the WAC code — never asked of the member directly.
  const [campus, setCampus] = useState(null); // { name }
  const [classDate, setClassDate] = useState('');

  const [elderList, setElderList] = useState([]);

  const [window_, setWindow] = useState([]); // [{date, times}]
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);

  const [elder, setElder] = useState(null); // { id, name }

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [emailSent, setEmailSent] = useState(true);

  function reset() {
    setStep(STEP.PREFERENCE);
    setDate(null);
    setTime(null);
    setElder(null);
    setWindow([]);
    setMemberName('');
    setMemberEmail('');
    setMemberPhone('');
    setNotes('');
    setError(null);
  }

  function submitCode(ev) {
    ev.preventDefault();
    setLoading(true);
    setCodeError(null);
    api('/scheduler-auth', { method: 'POST', body: JSON.stringify({ code }) })
      .then((data) => {
        setCampus({ name: data.campus });
        setClassDate(data.classDate);
        setStep(STEP.PREFERENCE);
      })
      .catch((e) => setCodeError(e.message))
      .finally(() => setLoading(false));
  }

  function loadElderList() {
    setLoading(true);
    setError(null);
    api(`/campus-elders?campusName=${encodeURIComponent(campus.name)}`)
      .then((list) => {
        setElderList(list);
        setStep(STEP.ELDER_LIST);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function chooseNoPreference() {
    setLoading(true);
    setError(null);
    api('/round-robin-elder', { method: 'POST', body: JSON.stringify({ campusName: campus.name }) })
      .then((e) => {
        setElder(e);
        loadWindow(e);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }

  function pickElder(e) {
    setElder(e);
    loadWindow(e);
  }

  // Takes the elder explicitly rather than reading it from state, since
  // this is sometimes called in the same tick as setElder() — state
  // updates aren't reflected in a closure until the next render, so
  // relying on the `elder` variable here would read the previous value.
  function loadWindow(forElder) {
    setLoading(true);
    setError(null);
    api(
      `/elder-availability-window?campusName=${encodeURIComponent(campus.name)}&classDate=${classDate}&elderName=${encodeURIComponent(forElder.name)}`
    )
      .then((w) => {
        setWindow(w);
        setStep(STEP.WINDOW);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function pickSlot(d, t) {
    setDate(d);
    setTime(t);
    setStep(STEP.MEMBER_FORM);
  }

  function chooseDifferentElder() {
    setElder(null);
    setDate(null);
    setTime(null);
    setWindow([]);
    // Both the "preferred" and "no preference" paths land here on the same
    // manual list once round-robin's pick doesn't work out — this is the
    // point where round-robin becomes a starting suggestion, not a lock-in.
    loadElderList();
  }

  function submitAppointment(ev) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    api('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        campusName: campus.name,
        elderName: elder.name,
        date,
        timeSlot: time,
        memberName,
        memberEmail,
        memberPhone,
      }),
    })
      .then((res) => {
        setEmailSent(res.emailSent !== false);
        setStep(STEP.CONFIRMED);
      })
      .catch((e) => {
        setError(e.message);
        if (e.message.includes('just booked')) {
          loadWindow(elder);
        }
      })
      .finally(() => setLoading(false));
  }

  function submitEngagementRequest(ev) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    api('/contact-engagement', {
      method: 'POST',
      body: JSON.stringify({ campusName: campus.name, memberName, memberEmail, notes }),
    })
      .then((res) => {
        setEmailSent(res.emailSent !== false);
        setStep(STEP.ENGAGEMENT_DONE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const formattedClassDate = classDate
    ? new Date(classDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="wizard">
      <img src="/logo.png" alt="Coastal Church" className="logo-img" />
      <h1>Elder Scheduling</h1>

      {step !== STEP.CODE_GATE && (
        <div className="breadcrumb">
          {campus && <span className="crumb done">Campus: {campus.name}</span>}
          {elder && <span className="crumb done">Elder: {elder.name}</span>}
          {date && <span className="crumb done">Date: {formatDateLabel(date)}</span>}
          {time && <span className="crumb done">Time: {time}</span>}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="loading-message">Loading…</p>}

      {!loading && step === STEP.CODE_GATE && (
        <form className="member-form" onSubmit={submitCode}>
          <h2>Enter code to schedule a meeting</h2>
          <input
            type="text"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <p className="empty-message" style={{ fontSize: '11px', marginTop: '4px' }}>
            The code is case-sensitive.
          </p>
          <button type="submit">Continue</button>
          {codeError && <p className="error-message">{codeError}</p>}
        </form>
      )}

      {!loading && step === STEP.PREFERENCE && (
        <>
          <h2>
            The code you entered indicates that you attended <strong>We Are Coastal</strong> on{' '}
            <strong>{formattedClassDate}</strong> at <strong>{campus?.name}</strong>. Do you have a preferred
            elder you would like to meet with?
          </h2>
          <div className="option-grid">
            <button className="option-btn" onClick={loadElderList}>
              Yes
            </button>
            <button className="option-btn" onClick={chooseNoPreference}>
              No preference
            </button>
          </div>
        </>
      )}

      {!loading && step === STEP.ELDER_LIST && (
        <>
          <h2>Choose your preferred elder</h2>
          <div className="option-grid">
            {elderList.map((e) => (
              <button key={e.id} className="option-btn" onClick={() => pickElder(e)}>
                {e.name}
              </button>
            ))}
          </div>
          {elderList.length === 0 && <p className="empty-message">No elders found for this campus.</p>}
          <button
            className="restart-btn"
            style={{ marginTop: '1.5rem' }}
            onClick={() => setStep(STEP.ENGAGEMENT_FORM)}
          >
            None of these work for me
          </button>
        </>
      )}

      {!loading && step === STEP.ENGAGEMENT_FORM && (
        <form className="member-form" onSubmit={submitEngagementRequest}>
          <h2>Let us know how to reach you</h2>
          <label>
            Your name
            <input required value={memberName} onChange={(e) => setMemberName(e.target.value)} />
          </label>
          <label>
            Your email
            <input required type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
          </label>
          <label>
            What would help? (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="submit">Submit</button>
        </form>
      )}

      {!loading && step === STEP.ENGAGEMENT_DONE && (
        <div className="confirmation">
          <p>Thank you — our engagement team will follow up to help find a time that works.</p>
          {!emailSent && (
            <p className="empty-message">(Note: the notification email couldn't be sent. The request itself was saved.)</p>
          )}
        </div>
      )}

      {!loading && step === STEP.WINDOW && (
        <>
          <h2>{elder?.name}'s availability over the next two weeks</h2>
          {window_.length === 0 && <p className="empty-message">No open times for this elder in the next two weeks.</p>}
          {window_.map((day) => (
            <div key={day.date} style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '6px' }}>{formatDateLabel(day.date)}</h3>
              <div className="option-grid">
                {day.times.map((t) => (
                  <button key={t} className="option-btn" onClick={() => pickSlot(day.date, t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="restart-btn" onClick={chooseDifferentElder}>
              None of these work — choose a different elder
            </button>
            <button className="restart-btn" onClick={() => setStep(STEP.ENGAGEMENT_FORM)}>
              None of these work for me
            </button>
          </div>
        </>
      )}

      {!loading && step === STEP.MEMBER_FORM && (
        <form className="member-form" onSubmit={submitAppointment}>
          <h2>Your information</h2>
          <label>
            Your name
            <input required value={memberName} onChange={(e) => setMemberName(e.target.value)} />
          </label>
          <label>
            Your email
            <input required type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
          </label>
          <label>
            Your phone number (optional)
            <input type="tel" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} />
          </label>
          <button type="submit">Confirm appointment</button>
        </form>
      )}

      {!loading && step === STEP.CONFIRMED && (
        <div className="confirmation">
          <p>
            Your meeting is confirmed — {campus.name}, {formatDateLabel(date)} at {time}, with {elder.name}.
          </p>
          <p>A confirmation email is on its way to you.</p>
          {!emailSent && (
            <p className="empty-message">(Note: the confirmation email couldn't be sent — this is expected while email isn't fully configured yet. Your appointment was saved.)</p>
          )}
        </div>
      )}

      {step !== STEP.CODE_GATE && step !== STEP.PREFERENCE && (
        <button className="restart-btn" onClick={reset}>
          Start over
        </button>
      )}

      <div style={{ marginTop: '3rem', borderTop: '1px solid #e5e5e2', paddingTop: '1rem' }}>
        <a href="/manage" className="empty-message" style={{ fontSize: '12px' }}>
          Elder or admin? Manage availability →
        </a>
      </div>
    </div>
  );
}
