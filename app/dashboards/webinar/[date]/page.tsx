import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  callsForWebinar,
  funnelStages,
  getCallsForBookingWeek,
  getWebinar,
  type WebinarCall,
} from "@/lib/webinar";
import { Badge } from "@/components/ui/badge";
import { DataFreshness } from "@/components/DataFreshness";
import { DevModeToggle } from "@/components/DevModeToggle";
import {
  CallsFilterBar,
  type StatusFilter,
} from "@/components/webinar/CallsFilterBar";
import { FunnelChart } from "@/components/webinar/FunnelChart";
import { Kpi } from "@/components/webinar/Kpi";
import {
  dayBadgeClass,
  eraBadgeClass,
  eraLabel,
  fmt,
} from "@/components/webinar/format";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const STATUS_KEYS: ReadonlyArray<StatusFilter> = [
  "all",
  "deal",
  "deposit",
  "showed",
  "setter-dq",
  "closer-dq",
  "none",
];

function pickStatus(v: string | string[] | undefined): StatusFilter {
  const s = pickStr(v, "all");
  return STATUS_KEYS.includes(s as StatusFilter) ? (s as StatusFilter) : "all";
}

export async function generateMetadata(
  props: PageProps<"/dashboards/webinar/[date]">,
) {
  const { date } = await props.params;
  return { title: `${date} · Webinar Performance · No More Mondays` };
}

export default async function WebinarDetailPage(
  props: PageProps<"/dashboards/webinar/[date]">,
) {
  const { date } = await props.params;
  if (!DATE_RE.test(date)) notFound();

  const sp = await props.searchParams;
  const closerFilter = pickStr(sp.closer);
  const setterFilter = pickStr(sp.setter);
  const flowFilter = pickStr(sp.flow);
  const statusFilter = pickStatus(sp.status);

  const [w, user, devMode] = await Promise.all([
    getWebinar(date),
    getCurrentUser(),
    getDevMode(),
  ]);

  if (!w) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">No webinar found</h1>
        <p className="text-sm text-muted-foreground">
          Nothing in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            mart_webinar_events
          </code>{" "}
          for <code className="rounded bg-muted px-1.5 py-0.5">{date}</code>.
          Pick another from the breadcrumb above.
        </p>
      </main>
    );
  }

  const allCalls = await getCallsForBookingWeek(w.booking_week_sun);
  const calls = callsForWebinar(allCalls, w).sort((a, b) =>
    (b.call_date_time ?? "").localeCompare(a.call_date_time ?? ""),
  );

  // Filter option universes (computed BEFORE applying current filters so the
  // dropdowns don't lose options when one filter narrows the visible set).
  const closers = Array.from(
    new Set(calls.map((c) => c.closer_owner).filter((x): x is string => !!x)),
  ).sort();
  const setters = Array.from(
    new Set(
      calls
        .map((c) => c.setter_owner ?? c.calendly_setter_name)
        .filter((x): x is string => !!x),
    ),
  ).sort();
  const flows = Array.from(
    new Set(
      calls.map((c) => c.final_marketing_flow).filter((x): x is string => !!x),
    ),
  ).sort();

  const filteredCalls = calls.filter((c) => {
    if (closerFilter && c.closer_owner !== closerFilter) return false;
    if (setterFilter && (c.setter_owner ?? c.calendly_setter_name) !== setterFilter)
      return false;
    if (flowFilter && c.final_marketing_flow !== flowFilter) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "deal" && !c.is_deal) return false;
      if (statusFilter === "deposit" && (!c.is_deposit || c.is_deal)) return false;
      if (
        statusFilter === "showed" &&
        (!c.is_show_up ||
          c.is_deal ||
          c.is_deposit ||
          c.call_outcome === "Setter DQ" ||
          c.call_outcome === "Closer DQ")
      )
        return false;
      if (statusFilter === "setter-dq" && c.call_outcome !== "Setter DQ")
        return false;
      if (statusFilter === "closer-dq" && c.call_outcome !== "Closer DQ")
        return false;
      if (
        statusFilter === "none" &&
        (c.is_show_up ||
          c.call_outcome === "Setter DQ" ||
          c.call_outcome === "Closer DQ")
      )
        return false;
    }
    return true;
  });

  const callStats = {
    shows: filteredCalls.filter((c) => c.is_show_up).length,
    deals: filteredCalls.filter((c) => c.is_deal).length,
    cash: filteredCalls.reduce((acc, c) => acc + (c.cash_collected ?? 0), 0),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8 lg:p-10">
      {/* Header */}
      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              {fmt.date(w.webinar_date)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={dayBadgeClass(w.webinar_day)}>
                {w.webinar_day || "—"}
              </Badge>
              <Badge variant="outline" className={eraBadgeClass(w.data_era)}>
                {eraLabel(w.data_era)}
              </Badge>
              {w.is_legacy ? (
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-muted-foreground"
                >
                  legacy
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <DataFreshness asOf={w.dbt_updated_at ?? null} />
            {user?.isAdmin ? <DevModeToggle current={devMode} /> : null}
          </div>
        </div>
      </header>

      {/* Marketing */}
      <Group title="Marketing">
        <Kpi
          label="Total Webinar Ad Spend"
          metric="total_webinar_ad_spend"
          devMode={devMode}
          value={fmt.money2(w.total_webinar_ad_spend)}
        />
        <Kpi
          label="Reg Ad Spend"
          metric="webinar_reg_ad_spend"
          devMode={devMode}
          value={fmt.money2(w.webinar_reg_ad_spend)}
        />
        <Kpi
          label="Hammer Them Ad Spend"
          metric="webinar_hammer_them_ad_spend"
          devMode={devMode}
          value={fmt.money2(w.webinar_hammer_them_ad_spend)}
        />
        <Kpi
          label="Hammer Them Frequency"
          metric="frequency_webinar_hammer_them"
          devMode={devMode}
          value={fmt.number(w.frequency_webinar_hammer_them, 2)}
          sub="impressions / reach"
        />
        <Kpi
          label="Impressions"
          metric="meta_impressions"
          devMode={devMode}
          value={fmt.number(w.meta_impressions, 1)}
        />
        <Kpi
          label="Meta Link Clicks"
          metric="meta_link_clicks"
          devMode={devMode}
          value={fmt.number(w.meta_link_clicks, 1)}
        />
        <Kpi label="Meta CTR" metric="meta_ctr" devMode={devMode} value={fmt.pct(w.meta_ctr)} />
        <Kpi label="Meta CVR" metric="meta_cvr" devMode={devMode} value={fmt.pct(w.meta_cvr)} />
        <Kpi
          label="Meta CPL"
          metric="meta_cpl"
          devMode={devMode}
          value={fmt.money2(w.meta_cpl)}
        />
        <Kpi
          label="Paid CPR"
          metric="paid_cpr"
          devMode={devMode}
          value={fmt.money2(w.paid_cpr)}
        />
        <Kpi
          label="Blended CPA"
          metric="blended_cpa"
          devMode={devMode}
          value={fmt.money2(w.blended_cpa)}
        />
        <Kpi
          label="Blended CPBC"
          metric="blended_cpbc"
          devMode={devMode}
          value={fmt.money2(w.blended_cpbc)}
        />
        <Kpi
          label="Cash / Attendee"
          metric="cash_collected_per_attendee"
          devMode={devMode}
          value={fmt.money2(w.cash_collected_per_attendee)}
        />
        <Kpi
          label="Contract Value / Attendee"
          metric="contract_value_per_attendee"
          devMode={devMode}
          value={fmt.money2(w.contract_value_per_attendee)}
        />
        <Kpi label="CAC" metric="cac" devMode={devMode} value={fmt.money2(w.cac)} />
      </Group>

      {/* Funnel */}
      <Group title="Funnel">
        <Kpi
          label="Page Views"
          metric="lp_page_views"
          devMode={devMode}
          value={fmt.int(w.lp_page_views)}
        />
        <Kpi
          label="Opt-ins"
          metric="lp_opt_ins"
          devMode={devMode}
          value={fmt.int(w.lp_opt_ins)}
          sub={fmt.pct(w.lp_opt_in_rate)}
        />
        <Kpi
          label="Form Submissions"
          metric="lp_form_submissions"
          devMode={devMode}
          value={fmt.int(w.lp_form_submissions)}
        />
        <Kpi
          label="Total Registrants"
          metric="total_registrants"
          devMode={devMode}
          value={fmt.int(w.total_registrants)}
        />
        <Kpi
          label="Unique Attendees"
          metric="unique_attendees"
          devMode={devMode}
          value={fmt.int(w.unique_attendees)}
          sub={fmt.pct(w.reg_to_attend_rate)}
        />
        <Kpi
          label="Pitched Attendees"
          metric="pitched_attendees"
          devMode={devMode}
          value={fmt.int(w.pitched_attendees)}
          sub={fmt.pct(w.attend_to_pitched_rate)}
        />
      </Group>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Registration source breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Meta" metric="meta_registrants" devMode={devMode} value={fmt.int(w.meta_registrants)} />
          <Kpi label="TikTok" metric="tiktok_registrants" devMode={devMode} value={fmt.int(w.tiktok_registrants)} />
          <Kpi label="ManyChat" metric="manychat_registrants" devMode={devMode} value={fmt.int(w.manychat_registrants)} />
          <Kpi label="Setter" metric="setter_registrants" devMode={devMode} value={fmt.int(w.setter_registrants)} />
          <Kpi label="Other / Organic" metric="other_organic_registrants" devMode={devMode} value={fmt.int(w.other_organic_registrants)} />
        </div>
      </section>

      {/* Sales */}
      <Group title="Sales">
        <Kpi label="Calls Booked" metric="calls_booked" devMode={devMode} value={fmt.int(w.calls_booked)} />
        <Kpi label="Active (non-canceled)" metric="calls_booked_active" devMode={devMode} value={fmt.int(w.calls_booked_active)} />
        <Kpi
          label="Shows"
          metric="shows"
          devMode={devMode}
          value={fmt.int(w.shows)}
          sub="excludes Setter DQs (PR #43)"
        />
        <Kpi
          label="Qualified Shows"
          metric="qualified_shows"
          devMode={devMode}
          value={fmt.int(w.qualified_shows)}
          sub="closer-qualified"
        />
        <Kpi label="Deposits" metric="webinar_deposits" devMode={devMode} value={fmt.int(w.webinar_deposits)} />
        <Kpi label="Deals Closed" metric="deals_closed" devMode={devMode} value={fmt.int(w.deals_closed)} />
        <Kpi label="Cash Collected" metric="cash_collected" devMode={devMode} value={fmt.money2(w.cash_collected)} />
        <Kpi label="Deposit Collected" metric="deposit_collected" devMode={devMode} value={fmt.money2(w.deposit_collected)} />
        <Kpi label="Revenue Generated" metric="revenue_generated" devMode={devMode} value={fmt.money2(w.revenue_generated)} />
        <Kpi label="Revenue Predicted" metric="revenue_predicted" devMode={devMode} value={fmt.money2(w.revenue_predicted)} />
        <Kpi label="Cost Per Show" metric="blended_cost_per_show" devMode={devMode} value={fmt.money2(w.blended_cost_per_show)} />
        <Kpi label="Cost Per Qualified Show" metric="blended_cost_per_qualified_show" devMode={devMode} value={fmt.money2(w.blended_cost_per_qualified_show)} />
        <Kpi label="Cost Per Active Booked Call" metric="blended_cpbc_active" devMode={devMode} value={fmt.money2(w.blended_cpbc_active)} />
        <Kpi
          label="ROAS (Cash)"
          metric="roas_cash"
          devMode={devMode}
          value={w.roas_cash == null ? "—" : fmt.ratio(w.roas_cash)}
        />
        <Kpi
          label="ROAS (Revenue)"
          metric="roas_revenue"
          devMode={devMode}
          value={w.roas_revenue == null ? "—" : fmt.ratio(w.roas_revenue)}
        />
        <Kpi
          label="Live ROAS"
          metric="roas_cash_running"
          devMode={devMode}
          value={fmt.ratio(w.roas_cash_running)}
          sub="running cash / spend"
        />
        <Kpi label="Pitch → Book Rate" metric="pitch_to_book_rate" devMode={devMode} value={fmt.pct(w.pitch_to_book_rate)} />
      </Group>

      {/* Funnel chart */}
      <FunnelChart
        stages={funnelStages(w)}
        title="Funnel"
        subtitle="bar = count at each stage; hover for stage-to-stage conversion"
      />

      {/* Calls drill-through */}
      <section className="space-y-3">
        <CallsFilterBar
          closer={closerFilter}
          setter={setterFilter}
          flow={flowFilter}
          status={statusFilter}
          closers={closers}
          setters={setters}
          flows={flows}
          filteredCount={filteredCalls.length}
          totalCount={calls.length}
          webinarDate={w.webinar_date}
        />

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Calls in this webinar&rsquo;s booking week
            </span>
            <span className="text-[11px] text-muted-foreground">
              {filteredCalls.length} of {calls.length} call
              {calls.length === 1 ? "" : "s"} &middot;{" "}
              {callStats.shows} show{callStats.shows === 1 ? "" : "s"} &middot;{" "}
              {callStats.deals} deal{callStats.deals === 1 ? "" : "s"} &middot;{" "}
              {fmt.money(callStats.cash)} cash
            </span>
          </div>
          <p className="px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            From{" "}
            <code className="rounded bg-muted px-1 py-0.5">int_calls_enriched</code>{" "}
            where{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              booking_week_sun = {w.booking_week_sun}
            </code>{" "}
            and the marketing flow matches this webinar day.
            {w.is_legacy
              ? " Legacy era — call-level data isn't available for older webinars."
              : ""}
          </p>
          {filteredCalls.length === 0 ? (
            <p className="px-4 pb-5 text-sm text-muted-foreground">
              {calls.length === 0
                ? "No call records for this webinar."
                : "No calls match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Prospect</th>
                    <th className="px-3 py-2 text-left font-medium">Closer</th>
                    <th className="px-3 py-2 text-left font-medium">Setter</th>
                    <th className="px-3 py-2 text-left font-medium">Flow</th>
                    <th className="px-3 py-2 text-left font-medium">Call time</th>
                    <th className="px-3 py-2 text-left font-medium">Outcome</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Cash</th>
                    <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map((c, i) => (
                    <tr
                      key={`${c.prospect_email_lc ?? "?"}-${c.call_date_time ?? i}`}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {c.prospect_name || "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.prospect_email_lc || ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {c.closer_owner || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {c.setter_owner || c.calendly_setter_name || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] text-muted-foreground">
                          {c.final_marketing_flow || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmt.dt(c.call_date_time)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {c.call_outcome || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <CallStatus call={c} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.cash_collected ? fmt.money(c.cash_collected) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {c.revenue_generated ? fmt.money(c.revenue_generated) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Raw mart row */}
      <details className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          View raw mart row (JSON)
        </summary>
        <pre className="mt-3 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify(w.raw, null, 2)}
        </pre>
      </details>
    </main>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {children}
      </div>
    </section>
  );
}

// Mutually-exclusive primary status using iOS-HIG-style colors. Priority,
// top → down: deal/deposit → setter/closer DQ → showed → cancellation
// flavor → fallback "—". A row NEVER renders both "showed" and "Setter
// DQ" (the pre-PR-#43 bug); is_show_up already excludes Setter DQs.
function CallStatus({ call }: { call: WebinarCall }) {
  if (call.is_deal) return <Pill tone="success-solid">Deal</Pill>;
  if (call.is_deposit) return <Pill tone="info">Deposit</Pill>;
  if (call.call_outcome === "Setter DQ") return <Pill tone="danger">Setter DQ</Pill>;
  if (call.call_outcome === "Closer DQ") return <Pill tone="warning">Closer DQ</Pill>;
  if (call.is_show_up) return <Pill tone="success-soft">Showed</Pill>;
  if (call.is_canceled) return <Pill tone="neutral">Canceled</Pill>;
  if (call.is_rescheduled) return <Pill tone="neutral">Rescheduled</Pill>;
  if (call.is_ghosted) return <Pill tone="neutral">Ghosted</Pill>;
  if (call.not_taken_category) {
    return <Pill tone="neutral">{call.not_taken_category}</Pill>;
  }
  return <span className="text-muted-foreground">—</span>;
}

type PillTone =
  | "success-solid"
  | "success-soft"
  | "info"
  | "warning"
  | "danger"
  | "neutral";

function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  const toneCls: Record<PillTone, string> = {
    "success-solid":
      "border-alert-green/40 bg-alert-green/20 text-alert-green",
    "success-soft":
      "border-alert-green/25 bg-alert-green/10 text-alert-green",
    info: "border-alert-blue/40 bg-alert-blue/15 text-alert-blue",
    warning:
      "border-alert-orange/40 bg-alert-orange/15 text-alert-orange",
    danger: "border-alert-red/40 bg-alert-red/15 text-alert-red",
    neutral: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={toneCls[tone]}>
      {children}
    </Badge>
  );
}
