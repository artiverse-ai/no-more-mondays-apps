// Client-side bridge to /api/calendly-search/enrich. After the Calendly
// fetch completes, posts the invitee emails + creation window to BQ and
// merges the held/deal/cash data back into the Row[].
//
// Match key: (email_lc, calendly_created_ts ISO string truncated to the
// second). Both sides come from the same Calendly event_uri so the
// timestamps line up exactly — we just have to format both the same way.

import { Row } from "./types";

export type EnrichedRow = {
  emailLc: string;
  createdAtIso: string;
  isCallHeld: boolean | null;
  isNotTaken: boolean | null;
  isShowUp: boolean | null;
  isDispositioned: boolean | null;
  isCanceled: boolean | null;
  isDeal: boolean | null;
  cashCollected: number | null;
  revenueGenerated: number | null;
  closerOwner: string | null;
  setterOwner: string | null;
  callOutcome: string | null;
};

function normalizeIsoToSecond(iso: string): string {
  // Both sides represent the same instant; trim milliseconds + ensure UTC
  // for stable string comparison.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export type EnrichmentMeta = {
  rows: Row[];
  matched: number;
  total: number;
  error?: string;
  // The resolved BQ query (with literals inlined) + stats for the Dev Mode
  // info button so the user can run it themselves in BigQuery.
  sql?: string;
  stats?: {
    emailsQueried: number;
    rowsReturned?: number;
    createdMin: string;
    createdMax: string;
  };
};

export async function enrichRows(
  rows: Row[],
  signal: AbortSignal,
): Promise<EnrichmentMeta> {
  if (rows.length === 0) return { rows, matched: 0, total: 0 };

  // Build the request payload from row info.
  const emails = Array.from(
    new Set(rows.map((r) => r.inviteeEmail).filter(Boolean)),
  );
  const createdAts = rows
    .map((r) => new Date(r.createdAt).getTime())
    .filter((t) => Number.isFinite(t));
  if (emails.length === 0 || createdAts.length === 0) {
    return { rows, matched: 0, total: rows.length };
  }
  const createdMin = new Date(Math.min(...createdAts) - 60_000).toISOString();
  const createdMax = new Date(Math.max(...createdAts) + 60_000).toISOString();

  let payload: { rows?: EnrichedRow[]; error?: string; sql?: string; stats?: EnrichmentMeta["stats"] };
  try {
    const res = await fetch("/api/calendly-search/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, createdMin, createdMax }),
      signal,
    });
    payload = await res.json();
    if (!res.ok) {
      return {
        rows, matched: 0, total: rows.length,
        error: payload.error || `HTTP ${res.status}`,
        sql: payload.sql,
        stats: payload.stats,
      };
    }
  } catch (e) {
    return { rows, matched: 0, total: rows.length, error: (e as Error).message };
  }

  const lookup = new Map<string, EnrichedRow>();
  for (const er of payload.rows ?? []) {
    lookup.set(`${er.emailLc}|${normalizeIsoToSecond(er.createdAtIso)}`, er);
  }

  let matched = 0;
  const out = rows.map((r) => {
    const key = `${r.inviteeEmail}|${normalizeIsoToSecond(r.createdAt)}`;
    const er = lookup.get(key);
    if (!er) return r;
    matched++;
    // Derive the call status. Canceled wins; otherwise BQ flags drive it.
    let status: Row["callStatus"] = r.callStatus;
    if (er.isCanceled || r.status === "canceled") {
      status = "canceled";
    } else if (er.isCallHeld === true || er.isDispositioned === true) {
      status = "held";
    } else if (er.isNotTaken === true) {
      status = "no_show";
    }
    return {
      ...r,
      callStatus: status,
      wasHeld: er.isCallHeld,
      wasNoShow: er.isNotTaken,
      isDeal: er.isDeal,
      cashCollected: er.cashCollected,
      revenueGenerated: er.revenueGenerated,
      closerOwner: er.closerOwner,
      setterOwner: er.setterOwner,
      callOutcome: er.callOutcome,
    };
  });

  return {
    rows: out,
    matched,
    total: rows.length,
    sql: payload.sql,
    stats: payload.stats,
  };
}
