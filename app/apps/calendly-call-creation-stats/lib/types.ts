// Calendly REST API shapes — only the fields we read.

export type CalendlyEventType = {
  uri: string;
  name?: string;
  kind?: string;
  pooling_type?: string | null;
  internal_note?: string | null;
  deleted_at?: string | null;
};

export type CalendlyEventMembership = {
  user?: string;
  user_name?: string;
  user_email?: string;
};

export type CalendlyScheduledEvent = {
  uri: string;
  name?: string;
  status: "active" | "canceled";
  event_type: string;
  start_time: string;
  end_time: string;
  created_at: string;
  event_memberships?: CalendlyEventMembership[];
  cancellation?: { reason?: string } | null;
  location?: { location?: string; join_url?: string } | null;
};

export type CalendlyInvitee = {
  uri: string;
  name?: string;
  email?: string;
  status: "active" | "canceled";
  created_at: string;
  timezone?: string;
  rescheduled?: boolean;
  old_invitee?: string | null;
  new_invitee?: string | null;
  cancellation?: { reason?: string } | null;
};

// Internal row shape used by the table.
export type Row = {
  id: string; // invitee URI
  eventUri: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeEmailDisplay: string;
  status: "active" | "canceled";
  eventName: string;
  eventTypeName: string;
  eventTypeKind: string;
  eventTypePooling: string | null;
  internalNote: string;
  hostName: string;
  hostEmail: string;
  hostNames: string[];
  hostEmails: string[];
  allHosts: string;
  allHostEmails: string;
  hostCount: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  cancelReason: string | null;
  timezone: string | null;
  location: string | null;
  oldInvitee: string | null;
  newInvitee: string | null;
  rescheduled: boolean;
  // ---- Optional BQ enrichment (populated after the Calendly fetch by
  //     /api/calendly-search/enrich). All fields can be null if no match
  //     was found in int_calls_enriched. ----
  callStatus: "future" | "held" | "no_show" | "canceled" | "unknown";
  wasHeld: boolean | null;
  wasNoShow: boolean | null;
  isDeal: boolean | null;
  cashCollected: number | null;
  revenueGenerated: number | null;
  closerOwner: string | null;
  setterOwner: string | null;
  callOutcome: string | null;
  // Internal references for the JSON modal — not serialized into CSV.
  _event: CalendlyScheduledEvent;
  _invitee: CalendlyInvitee;
  _eventType: CalendlyEventType;
};

// Creation-time presets only — booking-created timestamps can't be in the
// future, so "next N days" / "future" presets are removed vs the sibling
// Funnel Search app.
export type PresetKey =
  | "today"
  | "last24h"
  | "last2d"
  | "last7d"
  | "last30d"
  | "last90d"
  | "custom";

export type Preset = {
  key: PresetKey;
  label: string;
  direction: "past" | "custom";
  amount: number | null;
  unit: "hours" | "days" | null;
};

export const PRESETS: Preset[] = [
  { key: "today", label: "Today", direction: "past", amount: 1, unit: "days" },
  { key: "last24h", label: "Last 24h", direction: "past", amount: 24, unit: "hours" },
  { key: "last2d", label: "Last 2 Days", direction: "past", amount: 2, unit: "days" },
  { key: "last7d", label: "Last 7 Days", direction: "past", amount: 7, unit: "days" },
  { key: "last30d", label: "Last 30 Days", direction: "past", amount: 30, unit: "days" },
  { key: "last90d", label: "Last 90 Days", direction: "past", amount: 90, unit: "days" },
  { key: "custom", label: "Custom Range", direction: "custom", amount: null, unit: null },
];

export type DebugStats = {
  eventTypesScanned: number;
  matchedTypes: number;
  eventsFetched: number;
  activeFetched: number;
  canceledFetched: number;
  finalRows: number;
  windowsTotal: number;
  windowsFailed: number;
  fetchErrors: string[];
};

export type SearchProgress = {
  message: string;
  pct: number;
  detail?: string;
  apiCalls: number;
  elapsedSec: number;
};

export type SearchResult = {
  rows: Row[];
  matchedEventTypes: CalendlyEventType[];
  debug: DebugStats;
  // The actual call-time window that was queried. Surfaced in the UI so the
  // user can verify "Future" really did cover their range.
  window: { start: string; end: string };
  // event_uri/invitee uri → original API payloads, used by JsonModal.
  rawById: Map<
    string,
    {
      event: CalendlyScheduledEvent;
      invitee: CalendlyInvitee;
      eventType: CalendlyEventType;
    }
  >;
};
