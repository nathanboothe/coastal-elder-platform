// Points at the unified elder-api (server/) — the same backend the web
// app uses, as of the Phase 3 backend merge. Previously pointed at the
// old standalone elder-android-backend service; that split existed only
// because the web app's original /manage was PIN-gated with no per-user
// identity, which is no longer true (see unified-platform-roadmap Section
// 3). Pointed directly at the Render service URL rather than the
// elder.techfoundry360.com custom domain — that domain's cutover isn't
// happening on a known timeline, and the app is being deliberately
// decoupled from Nathan's own tenant/domain, so this is the stable
// reference for now.
const API_BASE = 'https://coastal-elder-platform-cprn.onrender.com/api';

// Not secrets — safe to have as real values here (embedded in the app itself).
// This is the "Coastal Elder App (Mobile Sign-in)" app registration in
// Coastal's own Entra tenant (public client, PKCE, no secret) — separate
// from the web app's registration and from the mail-sending registration.
// The backend validates against this same client ID via
// ENTRA_MOBILE_CLIENT_ID (server/config.js) — keep the two in sync.
export const ENTRA_CONFIG = {
  tenantId: 'f13afb20-c1c8-4f62-8ca6-64749966c378',
  clientId: '24826b55-00b2-4963-ad2a-3164c26eb06f',
};

// --- Session state ---
// Kept in-memory only (not persisted across app restarts) — re-signing in
// with Microsoft after a full app close is an acceptable tradeoff for not
// adding SecureStore complexity yet. Can be upgraded to persisted storage
// later if that turns out to matter in practice.
let adminSessionToken: string | null = null;

// Holds the PKCE code_verifier between launching the Entra sign-in browser
// and the app reopening via the redirect — a plain module variable, not
// React state, since the screen that initiated sign-in may not survive
// the round-trip if expo-router resets the navigation stack on deep link.
let pendingCodeVerifier: string | null = null;

export function setPendingCodeVerifier(verifier: string) {
  pendingCodeVerifier = verifier;
}

export function takePendingCodeVerifier(): string | null {
  const v = pendingCodeVerifier;
  pendingCodeVerifier = null;
  return v;
}

export type AvailabilityRow = {
  id: string;
  'Elder Name': string;
  'Day of Week': string;
  'Week of Month': string[];
  'Time Slots': string[];
};

export type TimeOffRow = {
  id: string;
  'Elder Name': string;
  'Start Date': string;
  'End Date': string;
  Notes?: string;
};

export type AdminElder = { id: string; name: string; campus: string };

let adminRole: 'admin' | 'elder' | null = null;
let adminElderName: string | null = null;

export function getAdminRole(): 'admin' | 'elder' | null {
  return adminRole;
}

export function getAdminElderName(): string | null {
  return adminElderName;
}

/**
 * Exchanges a verified Entra ID token for this app's own admin-scoped
 * session token. The backend checks the token's signature/issuer/audience
 * and group membership before issuing one, and also determines the
 * hybrid role — see elder-android-backend's lib/entraAuth.js and
 * lib/schedulerAuth.js.
 */
export async function loginWithEntraIdToken(
  idToken: string
): Promise<{ name: string; role: 'admin' | 'elder'; elderName: string | null }> {
  const response = await fetch(`${API_BASE}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Sign-in failed (${response.status})`);
  }

  const data = await response.json();
  adminSessionToken = data.token;
  adminRole = data.role;
  adminElderName = data.elderName ?? null;
  return { name: data.name, role: data.role, elderName: adminElderName };
}

export type M365SyncSummary = {
  added: string[];
  updated: string[];
  reactivated: string[];
  deactivated: string[];
  skipped: { name: string; reason: string }[];
  cancelledAppointments: {
    elderName: string;
    memberName: string;
    memberEmail: string;
    campus: string;
    date: string;
    timeSlot: string;
  }[];
  duplicates: { name: string; objectId: string; groups: string[] }[];
};

export async function refreshFromM365(): Promise<M365SyncSummary> {
  const response = await fetch(`${API_BASE}/elder-sync/refresh`, {
    method: 'POST',
    headers: adminAuthHeaders(),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Failed to refresh from M365 (${response.status})`);
  }
  return response.json();
}

export async function fetchAllElders(): Promise<AdminElder[]> {
  const response = await fetch(`${API_BASE}/all-elders`, { headers: adminAuthHeaders() });
  if (!response.ok) throw new Error(`Failed to load elders (${response.status})`);
  return response.json();
}

export async function fetchElderAvailability(elderName: string): Promise<AvailabilityRow[]> {
  const params = new URLSearchParams({ elderName });
  const response = await fetch(`${API_BASE}/elder-availability?${params.toString()}`, {
    headers: adminAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to load availability (${response.status})`);
  return response.json();
}

export async function createElderAvailability(input: {
  elderName: string;
  dayOfWeek: string;
  weekOfMonth: string[];
  timeSlots: string[];
}): Promise<void> {
  const response = await fetch(`${API_BASE}/elder-availability`, {
    method: 'POST',
    headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Failed to save availability (${response.status})`);
  }
}

export async function deleteElderAvailability(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/elder-availability/${id}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to delete availability (${response.status})`);
}

export async function fetchElderTimeOff(elderName: string): Promise<TimeOffRow[]> {
  const params = new URLSearchParams({ elderName });
  const response = await fetch(`${API_BASE}/elder-timeoff?${params.toString()}`, {
    headers: adminAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to load time off (${response.status})`);
  return response.json();
}

export async function createElderTimeOff(input: {
  elderName: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/elder-timeoff`, {
    method: 'POST',
    headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Failed to save time off (${response.status})`);
  }
}

export async function deleteElderTimeOff(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/elder-timeoff/${id}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to delete time off (${response.status})`);
}

export type WacCode = {
  id: string;
  code: string;
  campus: string;
  classDate: string;
  active: boolean;
};

function adminAuthHeaders(): HeadersInit {
  if (!adminSessionToken) {
    throw new Error('Not signed in as admin.');
  }
  return { Authorization: `Bearer ${adminSessionToken}` };
}

export async function fetchWacCodes(): Promise<WacCode[]> {
  const response = await fetch(`${API_BASE}/wac-codes`, { headers: adminAuthHeaders() });
  if (!response.ok) throw new Error(`Failed to load codes (${response.status})`);
  return response.json();
}

export async function createWacCode(input: {
  code: string;
  campusName: string;
  classDate: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/wac-codes`, {
    method: 'POST',
    headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Failed to create code (${response.status})`);
  }
}

export async function deactivateWacCode(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/wac-codes/${id}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to deactivate code (${response.status})`);
}