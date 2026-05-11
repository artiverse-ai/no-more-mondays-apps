import { Row, DateFilterMode } from "./types";
import { fmtDate } from "./format";

export function exportCsv(rows: Row[], mode: DateFilterMode) {
  const headers = [
    "Invitee Name",
    "Email",
    "Status",
    "Event Type",
    "Event Type Kind",
    "Pooling Type",
    "Internal Note",
    "Host",
    "Host Email",
    "All Hosts",
    "Start Time",
    "End Time",
    "Booked At",
    "Timezone",
    "Cancel Reason",
    "Location",
  ];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const data = rows.map((r) => [
    r.inviteeName,
    r.inviteeEmailDisplay,
    r.status,
    r.eventTypeName,
    r.eventTypeKind,
    r.eventTypePooling || "",
    escape(r.internalNote || ""),
    r.hostName,
    r.hostEmail,
    escape(r.allHosts || ""),
    fmtDate(r.startTime),
    fmtDate(r.endTime),
    fmtDate(r.createdAt),
    r.timezone || "",
    r.cancelReason || "",
    r.location || "",
  ]);
  const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calendly-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
