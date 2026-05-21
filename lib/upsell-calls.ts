// Calendly "Scaling Call" bookings → Airtable "Upsell Calls" table.
//
// Handles the BOOKING lifecycle for the NMM Coaching CRM:
//   invitee.created  → create the row (Status = Upcoming)
//   invitee.canceled → flip the row to Cancelled, or to Rescheduled
//                      when the cancellation is the old leg of a
//                      reschedule (a fresh invitee.created follows it)
//
// The DISPOSITION half — call outcome, cash, revenue, no-show — is
// filled by the coach later and is a separate phase.
//
// Student linkage: matched by invitee email against the Students table.
// No match → the row is still created but left unlinked (Linked stays
// off) so it can be reconciled by hand.
//
// Rows are keyed by the Calendly join URL (it embeds the scheduled-event
// UUID) — used both to skip duplicate deliveries and to locate the row
// to update on cancellation.

const AIRTABLE_API = "https://api.airtable.com/v0";
const BASE = "appyrIU7120p0T3kT"; // NMM | Coaching CRM
const UPSELL_CALLS = "tblkS06zl0YBBnnsz";
const STUDENTS = "tblMfk20VffSuxUIb";
const PEOPLE = "tblyQCMReBJDmMT3r";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// An event type counts as an upsell "scaling call" if its name starts
// with "Scaling". This catches both the per-coach links
// ("Scaling Call | Coach Renard") AND a round-robin link (named just
// "Scaling Call", with Calendly assigning the coach) — so round-robin
// works the moment that link is created, with zero code changes.
function isScalingCall(eventName?: string): boolean {
  return /^\s*scaling/i.test(eventName ?? "");
}

// Resolve the coach's first name: from the "| Coach X" suffix when the
// link is coach-specific, otherwise from the Calendly-assigned host
// (round-robin links — Calendly picks the coach).
function resolveCoach(eventName?: string, hostName?: string): string {
  const m = eventName?.match(/\|\s*coach\s+([a-z]+)/i);
  if (m) return cap(m[1]);
  const first = (hostName ?? "").trim().split(/\s+/)[0];
  return first ? cap(first) : "";
}

/** Calendly v2 webhook payload — only the fields we read. Shared shape
 *  for invitee.created and invitee.canceled. */
export type CalendlyWebhook = {
  event?: string;
  payload?: {
    name?: string;
    email?: string;
    cancel_url?: string;
    reschedule_url?: string;
    rescheduled?: boolean;
    scheduled_event?: {
      name?: string;
      start_time?: string;
      end_time?: string;
      location?: { join_url?: string };
      event_memberships?: Array<{ user_name?: string; user_email?: string }>;
    };
  };
};

function token(): string {
  const t = process.env.AIRTABLE_TOKEN;
  if (!t) throw new Error("AIRTABLE_TOKEN not set");
  return t;
}

async function airtable<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AIRTABLE_API}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const escapeFormula = (s: string) => s.replace(/'/g, "\\'");

/** Find a Students-table record id by email (case-insensitive). */
async function findStudentRecordId(email: string): Promise<string | null> {
  const formula = `LOWER({Email})='${escapeFormula(email.toLowerCase())}'`;
  const data = await airtable<{ records: Array<{ id: string }> }>(
    `${BASE}/${STUDENTS}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
  );
  return data.records[0]?.id ?? null;
}

/** Find a People-table record id by first name (case-insensitive) —
 *  links the coach. No match → left unlinked (the plain-text Coach
 *  field still carries the name). */
async function findCoachRecordId(firstName: string): Promise<string | null> {
  if (!firstName) return null;
  const formula = `LOWER({First Name})='${escapeFormula(firstName.toLowerCase())}'`;
  const data = await airtable<{ records: Array<{ id: string }> }>(
    `${BASE}/${PEOPLE}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
  );
  return data.records[0]?.id ?? null;
}

/** Find an existing Upsell Calls row by its Calendly join URL. */
async function findUpsellCallByJoinUrl(joinUrl: string): Promise<string | null> {
  const formula = `{Calendly Meeting Link}='${escapeFormula(joinUrl)}'`;
  const data = await airtable<{ records: Array<{ id: string }> }>(
    `${BASE}/${UPSELL_CALLS}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
  );
  return data.records[0]?.id ?? null;
}

export type CalendlyResult =
  | { status: "created"; recordId: string; coach: string; linked: boolean }
  | { status: "updated"; recordId: string; newStatus: string }
  | { status: "skipped"; reason: string };

/** Dispatch a Calendly webhook to the right handler. */
export async function handleCalendlyEvent(
  body: CalendlyWebhook,
): Promise<CalendlyResult> {
  if (body.event === "invitee.created") return handleBooking(body);
  if (body.event === "invitee.canceled") return handleCancellation(body);
  return { status: "skipped", reason: `event=${body.event}` };
}

async function handleBooking(body: CalendlyWebhook): Promise<CalendlyResult> {
  const p = body.payload ?? {};
  const ev = p.scheduled_event ?? {};
  if (!isScalingCall(ev.name)) return { status: "skipped", reason: "not a scaling call" };
  const coach = resolveCoach(ev.name, ev.event_memberships?.[0]?.user_name);

  const joinUrl = ev.location?.join_url ?? "";
  if (joinUrl && (await findUpsellCallByJoinUrl(joinUrl))) {
    return { status: "skipped", reason: "duplicate booking" };
  }

  const email = (p.email ?? "").trim();
  const studentId = email ? await findStudentRecordId(email) : null;
  const coachId = await findCoachRecordId(coach);

  const fields: Record<string, unknown> = {
    "Student": p.name ?? "",
    "Email": email,
    "Source": "Coach Booked ", // exact existing select option (note trailing space)
    "Status": "Upcoming",
    "Coach": coach,
    "Event Name": ev.name ?? "",
    "Linked": Boolean(studentId),
  };
  if (ev.start_time) fields["Event Start Date/Time"] = ev.start_time;
  if (ev.end_time) fields["Event End Date/Time copy"] = ev.end_time;
  if (joinUrl) fields["Calendly Meeting Link"] = joinUrl;
  if (p.reschedule_url) fields["Calendly Reschedule Link"] = p.reschedule_url;
  if (p.cancel_url) fields["Calendly Cancel Meeting Link"] = p.cancel_url;
  if (studentId) fields["Student Name"] = [studentId];
  if (coachId) fields["Coach Name"] = [coachId];

  const created = await airtable<{ id: string }>(`${BASE}/${UPSELL_CALLS}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return { status: "created", recordId: created.id, coach, linked: Boolean(studentId) };
}

async function handleCancellation(body: CalendlyWebhook): Promise<CalendlyResult> {
  const p = body.payload ?? {};
  const ev = p.scheduled_event ?? {};
  if (!isScalingCall(ev.name)) {
    return { status: "skipped", reason: "not a scaling call" };
  }
  const joinUrl = ev.location?.join_url ?? "";
  if (!joinUrl) return { status: "skipped", reason: "no join url" };

  const recordId = await findUpsellCallByJoinUrl(joinUrl);
  if (!recordId) return { status: "skipped", reason: "no matching row" };

  // A reschedule arrives as a cancellation of the old leg (rescheduled
  // = true) plus a fresh invitee.created for the new time. Mark the old
  // row Rescheduled; the new row is created by handleBooking.
  const newStatus = p.rescheduled ? "Rescheduled" : "Cancelled";
  await airtable(`${BASE}/${UPSELL_CALLS}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { Status: newStatus } }),
  });
  return { status: "updated", recordId, newStatus };
}
