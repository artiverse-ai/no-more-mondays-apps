// BQ-backed search for /apps/calendly-call-creation-stats.
//
// Replaces the 6-phase live-Calendly-API pipeline (30-60s, fan-out across
// users/event_types/scheduled_events/invitees) with a single query against
// `dbt_tuddin.stg_calendly` — a pre-joined view of
//   event ⋈ invitee ⋈ event_type ⋈ event_membership ⋈ users.
//
// Trade-offs vs the live pipeline:
//   - Data is ~6h stale (Fivetran sync cadence, not real-time)
//   - For multi-host events we only carry the primary assigned_rep —
//     stg_calendly collapses memberships to one row. Secondary hosts
//     on round-robin events aren't surfaced. Acceptable for the
//     creation-stats use case (which is about volume + funnel, not
//     individual host attribution).
//
// Gated by Vercel Authentication (project-wide cookie auth).

import { NextResponse } from "next/server";
import { bq } from "@/lib/bq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  notes: string[];
  titlePrefix?: string | null;
  start: string; // ISO
  end: string;   // ISO
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const notes = (body.notes ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (notes.length === 0) {
    return NextResponse.json({ error: "notes[] required" }, { status: 400 });
  }
  if (!body.start || !body.end) {
    return NextResponse.json({ error: "start/end required" }, { status: 400 });
  }

  const sql = `
    SELECT
      event_uri,
      invitee_email,
      invitee_name,
      invitee_status,
      invitee_timezone,
      invitee_created_at,
      event_name,
      event_type_uri,
      event_type_name,
      kind                AS event_type_kind,
      pooling_type,
      internal_note,
      assigned_rep_name,
      assigned_rep_email,
      start_time,
      end_time,
      event_created_at,
      status              AS event_status,
      cancel_reason,
      canceled_by,
      canceler_type,
      location_type,
      is_rescheduled
    FROM \`no-more-mondays-analytics.dbt_tuddin.stg_calendly\`
    WHERE LOWER(internal_note) IN UNNEST(@notes)
      AND invitee_created_at >= TIMESTAMP(@start)
      AND invitee_created_at <= TIMESTAMP(@end)
      ${body.titlePrefix
        ? "AND STARTS_WITH(LOWER(event_type_name), LOWER(@titlePrefix))"
        : ""}
    ORDER BY invitee_created_at DESC
  `;

  const [rowsRaw] = await bq().query({
    query: sql,
    params: {
      notes,
      start: body.start,
      end: body.end,
      ...(body.titlePrefix ? { titlePrefix: body.titlePrefix } : {}),
    },
    types: {
      notes: ["STRING"],
      start: "STRING",
      end: "STRING",
      ...(body.titlePrefix ? { titlePrefix: "STRING" } : {}),
    },
  });
  const sourceRows = rowsRaw as Array<Record<string, unknown>>;

  // Map each BQ row to the UI's Row shape. We synthesize the nested
  // _event / _invitee / _eventType payloads so the existing JsonModal
  // can render them with the same field names it used for live API
  // payloads. Anything we don't have from stg_calendly is omitted —
  // the modal just shows fewer keys for those rows.
  const ts = (v: unknown): string => {
    if (typeof v === "string") return v;
    const val = (v as { value?: string })?.value;
    return val ?? "";
  };
  const rows = sourceRows.map((r) => {
    const eventUri = String(r.event_uri ?? "");
    const inviteeEmail = String(r.invitee_email ?? "");
    const inviteeId = `${eventUri}::${inviteeEmail.toLowerCase()}`;
    const hostName = (r.assigned_rep_name as string) || "—";
    const hostEmail = (r.assigned_rep_email as string) || "";
    const status = r.invitee_status === "canceled" || r.event_status === "canceled"
      ? "canceled" as const
      : "active" as const;
    const createdAt = ts(r.invitee_created_at) || ts(r.event_created_at);

    const event = {
      uri: eventUri,
      name: r.event_name as string,
      status,
      event_type: String(r.event_type_uri ?? ""),
      start_time: ts(r.start_time),
      end_time: ts(r.end_time),
      created_at: ts(r.event_created_at),
      event_memberships: hostEmail
        ? [{ user_name: hostName, user_email: hostEmail }]
        : [],
      cancellation: r.cancel_reason
        ? { reason: r.cancel_reason as string }
        : null,
      location: r.location_type ? { location: r.location_type as string } : null,
    };
    const invitee = {
      uri: inviteeId,
      name: r.invitee_name as string,
      email: inviteeEmail,
      status,
      created_at: createdAt,
      timezone: (r.invitee_timezone as string) || undefined,
      rescheduled: Boolean(r.is_rescheduled),
      cancellation: r.cancel_reason
        ? { reason: r.cancel_reason as string }
        : null,
    };
    const eventType = {
      uri: String(r.event_type_uri ?? ""),
      name: r.event_type_name as string,
      kind: (r.event_type_kind as string) || undefined,
      pooling_type: (r.pooling_type as string) || null,
      internal_note: (r.internal_note as string) || null,
    };

    return {
      id: inviteeId,
      eventUri,
      inviteeName: r.invitee_name as string || "—",
      inviteeEmail: inviteeEmail.toLowerCase(),
      inviteeEmailDisplay: inviteeEmail || "—",
      status,
      eventName: (r.event_name as string) || "—",
      eventTypeName: (r.event_type_name as string) || "—",
      eventTypeKind: (r.event_type_kind as string) || "—",
      eventTypePooling: (r.pooling_type as string) || null,
      internalNote: (r.internal_note as string) || "",
      hostName,
      hostEmail,
      hostNames: hostName !== "—" ? [hostName] : [],
      hostEmails: hostEmail ? [hostEmail] : [],
      allHosts: hostName !== "—" ? hostName : "",
      allHostEmails: hostEmail,
      hostCount: hostEmail ? 1 : 0,
      startTime: ts(r.start_time),
      endTime: ts(r.end_time),
      createdAt,
      cancelReason: (r.cancel_reason as string) || null,
      timezone: (r.invitee_timezone as string) || null,
      location: (r.location_type as string) || null,
      oldInvitee: null,
      newInvitee: null,
      rescheduled: Boolean(r.is_rescheduled),
      _event: event,
      _invitee: invitee,
      _eventType: eventType,
    };
  });

  // matchedEventTypes — distinct event_type rows that appear in the
  // result. The UI's MatchedPills component reads this to chip-summarize.
  const seen = new Set<string>();
  const matchedEventTypes: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (seen.has(r._eventType.uri)) continue;
    seen.add(r._eventType.uri);
    matchedEventTypes.push(r._eventType);
  }

  return NextResponse.json({
    rows,
    matchedEventTypes,
    window: { start: body.start, end: body.end },
    debug: {
      eventTypesScanned: matchedEventTypes.length,
      matchedTypes: matchedEventTypes.length,
      eventsFetched: rows.length,
      activeFetched: rows.filter((r) => r.status === "active").length,
      canceledFetched: rows.filter((r) => r.status === "canceled").length,
      finalRows: rows.length,
      windowsTotal: 1,
      windowsFailed: 0,
      fetchErrors: [],
    },
  });
}
