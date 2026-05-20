// Calendly "Scaling Call" bookings → Airtable "Upsell Calls" table.
//
// When a student books one of the per-coach "Scaling Call | Coach X"
// Calendly event types, this writes the BOOKING half of an Upsell Calls
// row in the NMM Coaching CRM: student, time, coach, Calendly links,
// Status = Upcoming. The coach fills the DISPOSITION half — call
// outcome, cash, revenue — after the call; that is a later phase.
//
// Student linkage: matched by invitee email against the Students table.
// No match → the row is still created but left unlinked (the Linked
// checkbox stays off) so it can be reconciled by hand.

const AIRTABLE_API = "https://api.airtable.com/v0";
const BASE = "appyrIU7120p0T3kT"; // NMM | Coaching CRM
const UPSELL_CALLS = "tblkS06zl0YBBnnsz";
const STUDENTS = "tblMfk20VffSuxUIb";

// "Scaling Call | Coach Renard" → "Renard". Matching by pattern (not a
// hard-coded coach list) means any new "Scaling Call | Coach X" event
// type added in Calendly flows through with zero code changes.
const SCALING_CALL_RE = /scaling call\s*\|\s*coach\s+([a-z]+)/i;

export function parseScalingCallCoach(eventName?: string): string | null {
  const m = eventName?.match(SCALING_CALL_RE);
  if (!m) return null;
  const n = m[1];
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

/** Calendly v2 `invitee.created` webhook payload — only the fields used. */
export type CalendlyInviteePayload = {
  event?: string;
  payload?: {
    name?: string;
    email?: string;
    cancel_url?: string;
    reschedule_url?: string;
    scheduled_event?: {
      name?: string;
      start_time?: string;
      end_time?: string;
      location?: { join_url?: string };
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

/** The Calendly join URL embeds the scheduled-event UUID, so it's a
 *  stable per-booking key — used here to skip duplicate deliveries. */
async function bookingExists(joinUrl: string): Promise<boolean> {
  const formula = `{Calendly Meeting Link}='${escapeFormula(joinUrl)}'`;
  const data = await airtable<{ records: unknown[] }>(
    `${BASE}/${UPSELL_CALLS}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
  );
  return data.records.length > 0;
}

export type BookingResult =
  | { status: "created"; recordId: string; coach: string; linked: boolean }
  | { status: "skipped"; reason: string };

export async function handleScalingCallBooking(
  body: CalendlyInviteePayload,
): Promise<BookingResult> {
  if (body.event !== "invitee.created") {
    return { status: "skipped", reason: `event=${body.event}` };
  }
  const p = body.payload ?? {};
  const ev = p.scheduled_event ?? {};
  const coach = parseScalingCallCoach(ev.name);
  if (!coach) return { status: "skipped", reason: "not a scaling call" };

  const joinUrl = ev.location?.join_url ?? "";
  if (joinUrl && (await bookingExists(joinUrl))) {
    return { status: "skipped", reason: "duplicate booking" };
  }

  const email = (p.email ?? "").trim();
  const studentId = email ? await findStudentRecordId(email) : null;

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

  const created = await airtable<{ id: string }>(`${BASE}/${UPSELL_CALLS}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return { status: "created", recordId: created.id, coach, linked: Boolean(studentId) };
}
