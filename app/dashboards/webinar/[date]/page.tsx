import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  callsForWebinar,
  funnelStages,
  getCallsForBookingWeek,
  getWebinar,
  type WebinarCall,
} from "@/lib/webinar";
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

  const w = await getWebinar(date);
  if (!w) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">No webinar found</h1>
        <p className="text-sm text-muted-foreground">
          Nothing in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">mart_webinar_events</code>{" "}
          for <code className="rounded bg-muted px-1.5 py-0.5">{date}</code>. Pick
          another from the breadcrumb above.
        </p>
      </main>
    );
  }

  const allCalls = await getCallsForBookingWeek(w.booking_week_sun);
  const calls = callsForWebinar(allCalls, w).sort((a, b) =>
    (b.call_date_time ?? "").localeCompare(a.call_date_time ?? ""),
  );
  const callStats = {
    held: calls.filter((c) => c.is_call_held).length,
    deals: calls.filter((c) => c.is_deal).length,
    cash: calls.reduce((acc, c) => acc + (c.cash_collected ?? 0), 0),
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
          {w.dbt_updated_at ? (
            <p className="text-xs text-muted-foreground">
              dbt updated {fmt.dt(w.dbt_updated_at)}
            </p>
          ) : null}
        </div>
      </header>

      {/* Marketing */}
      <Group title="Marketing">
        <Kpi label="Total Webinar Ad Spend" value={fmt.money2(w.total_webinar_ad_spend)} />
        <Kpi label="Reg Ad Spend" value={fmt.money2(w.webinar_reg_ad_spend)} />
        <Kpi label="Hammer Them Ad Spend" value={fmt.money2(w.webinar_hammer_them_ad_spend)} />
        <Kpi
          label="Hammer Them Frequency"
          value={fmt.number(w.frequency_webinar_hammer_them, 2)}
          sub="impressions / reach"
        />
        <Kpi label="Impressions" value={fmt.number(w.meta_impressions, 1)} />
        <Kpi label="Meta Link Clicks" value={fmt.number(w.meta_link_clicks, 1)} />
        <Kpi label="Meta CTR" value={fmt.pct(w.meta_ctr)} />
        <Kpi label="Meta CVR" value={fmt.pct(w.meta_cvr)} />
        <Kpi label="Meta CPL" value={fmt.money2(w.meta_cpl)} />
        <Kpi label="Paid CPR" value={fmt.money2(w.paid_cpr)} />
        <Kpi label="Blended CPA" value={fmt.money2(w.blended_cpa)} />
        <Kpi label="Blended CPBC" value={fmt.money2(w.blended_cpbc)} />
        <Kpi label="Cash / Attendee" value={fmt.money2(w.cash_collected_per_attendee)} />
        <Kpi label="Contract Value / Attendee" value={fmt.money2(w.contract_value_per_attendee)} />
        <Kpi label="CAC" value={fmt.money2(w.cac)} />
      </Group>

      {/* Funnel */}
      <Group title="Funnel">
        <Kpi label="Page views" value={fmt.int(w.lp_page_views)} />
        <Kpi label="Opt-ins" value={fmt.int(w.lp_opt_ins)} sub={fmt.pct(w.lp_opt_in_rate)} />
        <Kpi label="Form submissions" value={fmt.int(w.lp_form_submissions)} />
        <Kpi label="Total registrants" value={fmt.int(w.total_registrants)} />
        <Kpi
          label="Unique attendees"
          value={fmt.int(w.unique_attendees)}
          sub={fmt.pct(w.reg_to_attend_rate)}
        />
        <Kpi
          label="Pitched attendees"
          value={fmt.int(w.pitched_attendees)}
          sub={fmt.pct(w.attend_to_pitched_rate)}
        />
      </Group>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Registration source breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Meta" value={fmt.int(w.meta_registrants)} />
          <Kpi label="TikTok" value={fmt.int(w.tiktok_registrants)} />
          <Kpi label="ManyChat" value={fmt.int(w.manychat_registrants)} />
          <Kpi label="Setter" value={fmt.int(w.setter_registrants)} />
          <Kpi label="Other / organic" value={fmt.int(w.other_organic_registrants)} />
        </div>
      </section>

      {/* Sales */}
      <Group title="Sales">
        <Kpi label="Calls booked" value={fmt.int(w.calls_booked)} />
        <Kpi label="Active (non-canceled)" value={fmt.int(w.calls_booked_active)} />
        <Kpi label="Shows" value={fmt.int(w.shows)} sub="excludes Setter DQs (PR #43)" />
        <Kpi label="Qualified Shows" value={fmt.int(w.qualified_shows)} sub="closer-qualified" />
        <Kpi label="Deposits" value={fmt.int(w.webinar_deposits)} />
        <Kpi label="Deals closed" value={fmt.int(w.deals_closed)} />
        <Kpi label="Cash collected" value={fmt.money2(w.cash_collected)} />
        <Kpi label="Deposit collected" value={fmt.money2(w.deposit_collected)} />
        <Kpi label="Revenue generated" value={fmt.money2(w.revenue_generated)} />
        <Kpi label="Revenue predicted" value={fmt.money2(w.revenue_predicted)} />
        <Kpi label="Cost Per Show" value={fmt.money2(w.blended_cost_per_show)} />
        <Kpi label="Cost Per Qualified Show" value={fmt.money2(w.blended_cost_per_qualified_show)} />
        <Kpi label="Cost Per Active Booked Call" value={fmt.money2(w.blended_cpbc_active)} />
        <Kpi
          label="ROAS (cash)"
          value={w.roas_cash == null ? "—" : fmt.ratio(w.roas_cash)}
        />
        <Kpi
          label="ROAS (revenue)"
          value={w.roas_revenue == null ? "—" : fmt.ratio(w.roas_revenue)}
        />
        <Kpi
          label="Live ROAS"
          value={fmt.ratio(w.roas_cash_running)}
          sub="running cash / spend"
        />
        <Kpi label="Pitch → book rate" value={fmt.pct(w.pitch_to_book_rate)} />
      </Group>

      {/* Funnel chart */}
      <FunnelChart
        stages={funnelStages(w)}
        title="Funnel"
        subtitle="bar = count at each stage; hover for stage-to-stage conversion"
      />

      {/* Calls drill-through */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Calls in this webinar&rsquo;s booking week
          </span>
          <span className="text-[11px] text-muted-foreground">
            {calls.length} call{calls.length === 1 ? "" : "s"} &middot;{" "}
            {callStats.held} held &middot; {callStats.deals} deal
            {callStats.deals === 1 ? "" : "s"} &middot; {fmt.money(callStats.cash)} cash
          </span>
        </div>
        <p className="px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          From <code className="rounded bg-muted px-1 py-0.5">int_calls_enriched</code>{" "}
          where{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            booking_week_sun = {w.booking_week_sun}
          </code>{" "}
          and the marketing flow matches this webinar day.
          {w.is_legacy
            ? " Legacy era — call-level data isn't available for older webinars."
            : ""}
        </p>
        {calls.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">
            No call records for this webinar.
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
                {calls.map((c, i) => (
                  <tr
                    key={`${c.prospect_email_lc ?? "?"}-${c.call_date_time ?? i}`}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.prospect_name || "—"}</div>
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

function CallStatus({ call }: { call: WebinarCall }) {
  const pills: React.ReactNode[] = [];
  if (call.is_deal) {
    pills.push(
      <Badge
        key="deal"
        variant="outline"
        className="border-emerald-300 bg-emerald-50 text-emerald-800"
      >
        deal
      </Badge>,
    );
  } else if (call.is_deposit) {
    pills.push(
      <Badge
        key="deposit"
        variant="outline"
        className="border-sky-300 bg-sky-50 text-sky-800"
      >
        deposit
      </Badge>,
    );
  } else if (call.is_call_held) {
    pills.push(
      <Badge
        key="held"
        variant="outline"
        className="border-border bg-muted text-muted-foreground"
      >
        held
      </Badge>,
    );
  }
  if (call.not_taken_category) {
    pills.push(
      <Badge
        key="ntc"
        variant="outline"
        className="border-border bg-muted text-muted-foreground"
      >
        {call.not_taken_category.toLowerCase()}
      </Badge>,
    );
  }
  return pills.length ? (
    <span className="flex flex-wrap gap-1">{pills}</span>
  ) : (
    <span>—</span>
  );
}
