import { useState } from 'react';

const STEP = {
  CODE_GATE: 'code_gate',
  PREFERENCE: 'preference',
  ELDER_LIST: 'elder_list',
  ENGAGEMENT_FORM: 'engagement_form',
  ENGAGEMENT_DONE: 'engagement_done',
  SUNDAY_CHECK: 'sunday_check',
  OPT_OUT_FORM: 'opt_out_form',
  OPT_OUT_DONE: 'opt_out_done',
  DATE: 'date',
  TIME: 'time',
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

function StepList({ items, getLabel, getSubLabel, onPick, emptyMessage, gridClassName }) {
  if (items.length === 0) {
    return <p className="empty-message">{emptyMessage}</p>;
  }
  return (
    <div className={`option-grid${gridClassName ? ` ${gridClassName}` : ''}`}>
      {items.map((item, i) => (
        <button key={i} className="option-btn" onClick={() => onPick(item)}>
          {getLabel(item)}
          {getSubLabel && (
            <span style={{ display: 'block', fontWeight: 400, fontSize: '11px', marginTop: 4, textTransform: 'none' }}>
              {getSubLabel(item)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
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

  const [wantsPreferred, setWantsPreferred] = useState(null); // true | false, drives ELDER_LIST heading only

  const [elderList, setElderList] = useState([]);

  const [dates, setDates] = useState([]);
  const [date, setDate] = useState(null);

  const [times, setTimes] = useState([]);
  const [time, setTime] = useState(null);

  const [elder, setElder] = useState(null); // { id, name }

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [emailSent, setEmailSent] = useState(true);

  function reset() {
    setStep(STEP.PREFERENCE);
    setWantsPreferred(null);
    setDate(null);
    setTime(null);
    setElder(null);
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

  function loadElderList(preferred) {
    setWantsPreferred(preferred);
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

  function pickElder(e) {
    setElder(e);
    setStep(STEP.SUNDAY_CHECK);
  }

  function pickSunday() {
    setLoading(true);
    setError(null);
    api(
      `/dates?campusName=${encodeURIComponent(campus.name)}&dayOfWeek=Sunday&classDate=${classDate}&elderName=${encodeURIComponent(elder.name)}`
    )
      .then((d) => {
        setDates(d);
        setStep(STEP.DATE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function pickDate(d) {
    setDate(d);
    setLoading(true);
    setError(null);
    api(
      `/times?campusName=${encodeURIComponent(campus.name)}&date=${d}&elderName=${encodeURIComponent(elder.name)}`
    )
      .then((t) => {
        setTimes(t);
        setStep(STEP.TIME);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function pickTime(t) {
    setTime(t);
    setStep(STEP.MEMBER_FORM);
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
          setStep(STEP.TIME);
        }
      })
      .finally(() => setLoading(false));
  }

  function submitOptOut(ev) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    api('/sunday-optout', {
      method: 'POST',
      body: JSON.stringify({
        campusName: campus.name,
        memberName,
        memberEmail,
        notes,
      }),
    })
      .then((res) => {
        setEmailSent(res.emailSent !== false);
        setStep(STEP.OPT_OUT_DONE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function submitEngagementRequest(ev) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    api('/contact-engagement', {
      method: 'POST',
      body: JSON.stringify({
        campusName: campus.name,
        memberName,
        memberEmail,
        notes,
      }),
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
          {date && (
            <span className="crumb done">
              Date: {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            </span>
          )}
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
          <button type="submit">Continue</button>
          {codeError && <p className="error-message">{codeError}</p>}
        </form>
      )}

      {!loading && step === STEP.PREFERENCE && (
        <>
          <h2>
            The code you entered indicates that you attended We Are Coastal on {formattedClassDate} at{' '}
            {campus?.name}. Do you have a preferred elder you would like to meet with?
          </h2>
          <div className="option-grid">
            <button className="option-btn" onClick={() => loadElderList(true)}>
              Yes
            </button>
            <button className="option-btn" onClick={() => loadElderList(false)}>
              No preference
            </button>
          </div>
        </>
      )}

      {!loading && step === STEP.ELDER_LIST && (
        <>
          <h2>{wantsPreferred ? 'Choose your preferred elder' : 'Elders at your campus'}</h2>
          <StepList
            items={elderList}
            getLabel={(e) => e.name}
            getSubLabel={(e) => (e.availability && e.availability.length > 0 ? e.availability.join(' · ') : 'Availability not yet set')}
            onPick={pickElder}
            emptyMessage="No Elders found for this campus."
          />
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

      {!loading && step === STEP.SUNDAY_CHECK && (
        <>
          <h2>When can you meet?</h2>
          <div className="option-grid">
            <button className="option-btn" onClick={pickSunday}>
              Sunday
            </button>
            <button className="option-btn" onClick={() => setStep(STEP.OPT_OUT_FORM)}>
              I can't meet on Sunday
            </button>
          </div>
        </>
      )}

      {!loading && step === STEP.OPT_OUT_FORM && (
        <form className="member-form" onSubmit={submitOptOut}>
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
            Notes (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="submit">Submit</button>
        </form>
      )}

      {!loading && step === STEP.OPT_OUT_DONE && (
        <div className="confirmation">
          <p>Thank you — we've let our engagement team know, and they'll follow up to find a time that works.</p>
          {!emailSent && (
            <p className="empty-message">(Note: the notification email couldn't be sent — this is expected while email isn't fully configured yet. The request itself was saved.)</p>
          )}
        </div>
      )}

      {!loading && step === STEP.DATE && (
        <>
          <h2>Choose a date to meet with {elder?.name}</h2>
          <StepList
            items={dates}
            getLabel={(d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            onPick={pickDate}
            emptyMessage="No upcoming Sundays are open for this elder right now."
          />
        </>
      )}

      {!loading && step === STEP.TIME && (
        <>
          <h2>Choose a time</h2>
          <StepList items={times} getLabel={(t) => t} onPick={pickTime} emptyMessage="No open times for that date." />
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
            Your meeting is confirmed — {campus.name}, {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} at {time}, with {elder.name}.
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
