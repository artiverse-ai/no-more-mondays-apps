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
  // Internal references for the JSON modal — not serialized into CSV.
  _event: CalendlyScheduledEvent;
  _invitee: CalendlyInvitee;
  _eventType: CalendlyEventType;
};

export type PresetKey =
  | "last4h"
  | "last24h"
  | "last2d"
  | "last7d"
  | "last30d"
  | "next4d"
  | "next7d"
  | "next14d"
  | "future"
  | "custom";

export type Preset = {
  key: PresetKey;
  label: string;
  direction: "past" | "future" | "all-future" | "custom";
  amount: number | null;
  unit: "hours" | "days" | null;
};

export const PRESETS: Preset[] = [
  { key: "last4h", label: "Last 4h", direction: "past", amount: 4, unit: "hours" },
  { key: "last24h", label: "Last 24h", direction: "past", amount: 24, unit: "hours" },
  { key: "last2d", label: "Last 2 Days", direction: "past", amount: 2, unit: "days" },
  { key: "last7d", label: "Last 7 Days", direction: "past", amount: 7, unit: "days" },
  { key: "last30d", label: "Last 30 Days", direction: "past", amount: 30, unit: "days" },
  { key: "next4d", label: "Next 4 Days", direction: "future", amount: 4, unit: "days" },
  { key: "next7d", label: "Next 7 Days", direction: "future", amount: 7, unit: "days" },
  { key: "next14d", label: "Next 14 Days", direction: "future", amount: 14, unit: "days" },
  { key: "future", label: "Future", direction: "all-future", amount: null, unit: null },
  { key: "custom", label: "Custom Range", direction: "custom", amount: null, unit: null },
];

export type DebugStats = {
  eventTypesScanned: number;
  matchedTypes: number;
  eventsFetched: number;
  activeFetched: number;
  canceledFetched: number;
  finalRows: number;
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
