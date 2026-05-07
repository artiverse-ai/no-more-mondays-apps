/* NMM Analytics Dashboard — vanilla JS, hash-routed SPA. */
"use strict";

const STATE = {
  webinars: [],
  calls: [],
  loaded: false,
  filters: {
    day: "all",
    era: "all",
    from: "",
    to: "",
  },
  sort: { key: "webinar_date", dir: "desc" },
  charts: {},
};

/* ---------- formatting ---------- */

const fmt = {
  int: (n) => (n == null ? "—" : Number(n).toLocaleString("en-US")),
  money: (n) =>
    n == null
      ? "—"
      : "$" +
        Number(n).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        }),
  money2: (n) =>
    n == null
      ? "—"
      : "$" +
        Number(n).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
  pct: (n) =>
    n == null
      ? "—"
      : (Number(n) * 100).toFixed(1) + "%",
  ratio: (n) =>
    n == null ? "—" : Number(n).toFixed(2) + "x",
  date: (s) => {
    if (!s) return "—";
    const d = new Date(s + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  },
  dateShort: (s) => {
    if (!s) return "—";
    const d = new Date(s + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  },
  dt: (s) => {
    if (!s) return "—";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },
};

const escapeHtml = (s) => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const dayPill = (day) => {
  const cls =
    day === "Sunday"
      ? "nm-pill-sun"
      : day === "Wednesday"
      ? "nm-pill-wed"
      : day === "Monthly Workshop"
      ? "nm-pill-monthly"
      : "nm-pill-legacy";
  return `<span class="nm-pill ${cls}">${escapeHtml(day)}</span>`;
};

const eraPill = (era) => {
  const cls =
    era === "core_new_ads"
      ? "nm-pill-new"
      : era === "core_old_ads"
      ? "nm-pill-old"
      : "nm-pill-legacy";
  const label =
    era === "core_new_ads"
      ? "new ads"
      : era === "core_old_ads"
      ? "old ads"
      : "legacy";
  return `<span class="nm-pill ${cls}">${label}</span>`;
};

/* ---------- data loading ---------- */

async function loadData() {
  if (STATE.loaded) return;
  const [webinars, calls] = await Promise.all([
    fetch("./data/webinar_events.json").then((r) => r.json()),
    fetch("./data/calls.json").then((r) => r.json()),
  ]);
  STATE.webinars = webinars;
  STATE.calls = calls;
  STATE.loaded = true;
  setMeta();
}

function setMeta() {
  const meta = document.getElementById("nm-meta");
  if (!meta) return;
  const latest = STATE.webinars[0];
  if (!latest) {
    meta.textContent = "";
    return;
  }
  const updatedTs = latest.dbt_updated_at;
  let updatedStr = "";
  if (updatedTs) {
    const d = new Date(updatedTs);
    if (!isNaN(d.getTime())) {
      updatedStr = "dbt updated " + d.toLocaleDateString();
    }
  }
  meta.innerHTML = `${STATE.webinars.length} webinars &middot; ${STATE.calls.length.toLocaleString()} calls${
    updatedStr ? " &middot; " + updatedStr : ""
  }`;
}

/* ---------- filtering ---------- */

function applyFilters(rows) {
  const f = STATE.filters;
  return rows.filter((r) => {
    if (f.day !== "all" && r.webinar_day !== f.day) return false;
    if (f.era !== "all" && r.data_era !== f.era) return false;
    if (f.from && r.webinar_date < f.from) return false;
    if (f.to && r.webinar_date > f.to) return false;
    return true;
  });
}

function applySort(rows) {
  const { key, dir } = STATE.sort;
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * m;
    return String(av).localeCompare(String(bv)) * m;
  });
}

/* ---------- routing ---------- */

function getRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) return { name: "overview" };
  if (hash.startsWith("webinar/")) {
    return { name: "detail", date: hash.slice("webinar/".length) };
  }
  return { name: "overview" };
}

function navigate(path) {
  location.hash = "#/" + path.replace(/^\//, "");
}

window.addEventListener("hashchange", render);

/* ---------- rendering ---------- */

async function render() {
  const root = document.getElementById("nm-app");
  if (!STATE.loaded) {
    root.innerHTML = `<div class="text-slate-400 py-12 text-center">Loading…</div>`;
    try {
      await loadData();
    } catch (e) {
      root.innerHTML = `<div class="text-rose-400 py-12 text-center">Failed to load data: ${escapeHtml(
        e.message
      )}</div>`;
      return;
    }
  }
  const route = getRoute();
  if (route.name === "detail") {
    renderDetail(route.date);
  } else {
    renderOverview();
  }
}

/* ---------- overview ---------- */

function kpi(label, value, sub) {
  return `
    <div class="nm-card p-4">
      <div class="text-xs text-slate-400 uppercase tracking-wide">${label}</div>
      <div class="text-2xl font-semibold mt-1 nm-num">${value}</div>
      ${sub ? `<div class="text-xs text-slate-500 mt-1">${sub}</div>` : ""}
    </div>
  `;
}

function computeKpis(rows) {
  if (rows.length === 0) {
    return {
      spend: 0,
      registrants: 0,
      attendees: 0,
      booked: 0,
      held: 0,
      deals: 0,
      cash: 0,
      revenue: 0,
      roas: null,
      cac: null,
    };
  }
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const spend = sum("ad_spend");
  const cash = sum("cash_collected");
  const revenue = sum("revenue_generated");
  const deals = sum("deals_closed");
  return {
    spend,
    registrants: sum("total_registrants"),
    attendees: sum("unique_attendees"),
    booked: sum("calls_booked"),
    held: sum("calls_held"),
    deals,
    cash,
    revenue,
    roas: spend > 0 ? cash / spend : null,
    cac: deals > 0 ? spend / deals : null,
  };
}

function renderOverview() {
  const root = document.getElementById("nm-app");
  document.getElementById("nm-subtitle").textContent = "Webinar performance overview";

  const filtered = applyFilters(STATE.webinars);
  const sorted = applySort(filtered);
  const kpis = computeKpis(filtered);

  const days = [...new Set(STATE.webinars.map((w) => w.webinar_day))];
  const eras = [...new Set(STATE.webinars.map((w) => w.data_era))];

  root.innerHTML = `
    <!-- filters -->
    <div class="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <label class="block text-xs text-slate-400 mb-1">Webinar day</label>
        <select data-filter="day" class="min-w-[160px]">
          <option value="all">All</option>
          ${days
            .map(
              (d) =>
                `<option value="${escapeHtml(d)}" ${
                  STATE.filters.day === d ? "selected" : ""
                }>${escapeHtml(d)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">Era</label>
        <select data-filter="era" class="min-w-[140px]">
          <option value="all">All</option>
          ${eras
            .map(
              (e) =>
                `<option value="${escapeHtml(e)}" ${
                  STATE.filters.era === e ? "selected" : ""
                }>${escapeHtml(e)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">From</label>
        <input type="date" data-filter="from" value="${STATE.filters.from}" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">To</label>
        <input type="date" data-filter="to" value="${STATE.filters.to}" />
      </div>
      <button id="nm-reset" class="text-xs text-slate-400 hover:text-slate-200 underline ml-auto">Reset filters</button>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      ${kpi("Webinars", fmt.int(filtered.length))}
      ${kpi("Ad spend", fmt.money(kpis.spend))}
      ${kpi("Registrants", fmt.int(kpis.registrants))}
      ${kpi("Attendees", fmt.int(kpis.attendees))}
      ${kpi("Calls booked", fmt.int(kpis.booked))}
      ${kpi("Calls held", fmt.int(kpis.held))}
      ${kpi("Deals closed", fmt.int(kpis.deals))}
      ${kpi("Cash collected", fmt.money(kpis.cash))}
      ${kpi("Revenue generated", fmt.money(kpis.revenue))}
      ${kpi(
        "Avg ROAS (cash)",
        kpis.roas == null ? "—" : fmt.ratio(kpis.roas),
        "cash / spend"
      )}
      ${kpi(
        "Avg CAC",
        kpis.cac == null ? "—" : fmt.money(kpis.cac),
        "spend / deal"
      )}
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="nm-card p-4">
        <h3 class="text-sm font-medium text-slate-300 mb-3">Ad spend &amp; cash collected</h3>
        <div class="h-64"><canvas id="chart-spend-cash"></canvas></div>
      </div>
      <div class="nm-card p-4">
        <h3 class="text-sm font-medium text-slate-300 mb-3">Deals closed per webinar</h3>
        <div class="h-64"><canvas id="chart-deals"></canvas></div>
      </div>
      <div class="nm-card p-4">
        <h3 class="text-sm font-medium text-slate-300 mb-3">ROAS (cash / spend)</h3>
        <div class="h-64"><canvas id="chart-roas"></canvas></div>
      </div>
      <div class="nm-card p-4">
        <h3 class="text-sm font-medium text-slate-300 mb-3">Funnel — most recent webinar</h3>
        <div class="h-64"><canvas id="chart-funnel"></canvas></div>
      </div>
    </div>

    <!-- Table -->
    <div class="nm-card p-2 mb-6">
      <div class="px-3 pt-2 pb-1 flex items-center justify-between">
        <h3 class="text-sm font-medium text-slate-300">All webinars</h3>
        <span class="text-xs text-slate-500">${filtered.length} of ${STATE.webinars.length} &middot; click row to drill in</span>
      </div>
      <div class="scroll-x">
        <table class="nm-table w-full text-sm">
          <thead>
            <tr>
              ${tableHeader("webinar_date", "Date")}
              ${tableHeader("webinar_day", "Day")}
              ${tableHeader("data_era", "Era")}
              ${tableHeader("ad_spend", "Spend", "right")}
              ${tableHeader("total_registrants", "Regs", "right")}
              ${tableHeader("unique_attendees", "Attendees", "right")}
              ${tableHeader("pitched_attendees", "Pitched", "right")}
              ${tableHeader("calls_booked", "Booked", "right")}
              ${tableHeader("calls_held", "Held", "right")}
              ${tableHeader("deals_closed", "Deals", "right")}
              ${tableHeader("cash_collected", "Cash", "right")}
              ${tableHeader("revenue_generated", "Revenue", "right")}
              ${tableHeader("roas_cash", "ROAS", "right")}
              ${tableHeader("cac", "CAC", "right")}
            </tr>
          </thead>
          <tbody>
            ${sorted
              .map(
                (r) => `
                <tr class="clickable" data-date="${escapeHtml(r.webinar_date)}">
                  <td class="font-medium">${fmt.date(r.webinar_date)}</td>
                  <td>${dayPill(r.webinar_day)}</td>
                  <td>${eraPill(r.data_era)}</td>
                  <td class="text-right nm-num">${fmt.money(r.ad_spend)}</td>
                  <td class="text-right nm-num">${fmt.int(r.total_registrants)}</td>
                  <td class="text-right nm-num">${fmt.int(r.unique_attendees)}</td>
                  <td class="text-right nm-num">${fmt.int(r.pitched_attendees)}</td>
                  <td class="text-right nm-num">${fmt.int(r.calls_booked)}</td>
                  <td class="text-right nm-num">${fmt.int(r.calls_held)}</td>
                  <td class="text-right nm-num">${fmt.int(r.deals_closed)}</td>
                  <td class="text-right nm-num">${fmt.money(r.cash_collected)}</td>
                  <td class="text-right nm-num">${fmt.money(r.revenue_generated)}</td>
                  <td class="text-right nm-num ${
                    r.roas_cash != null && r.roas_cash >= 1 ? "nm-good" : ""
                  }">${r.roas_cash == null ? "—" : fmt.ratio(r.roas_cash)}</td>
                  <td class="text-right nm-num">${fmt.money(r.cac)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // wire filter events
  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("change", (e) => {
      STATE.filters[e.target.dataset.filter] = e.target.value;
      renderOverview();
    });
  });
  document.getElementById("nm-reset").addEventListener("click", () => {
    STATE.filters = { day: "all", era: "all", from: "", to: "" };
    renderOverview();
  });
  // sort header clicks
  document.querySelectorAll("[data-sort]").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.dataset.sort;
      if (STATE.sort.key === key) {
        STATE.sort.dir = STATE.sort.dir === "asc" ? "desc" : "asc";
      } else {
        STATE.sort = { key, dir: "desc" };
      }
      renderOverview();
    });
  });
  // row clicks
  document.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => navigate("webinar/" + tr.dataset.date));
  });

  drawCharts(filtered);
}

function tableHeader(key, label, align = "left") {
  const arrow =
    STATE.sort.key === key ? (STATE.sort.dir === "asc" ? " ↑" : " ↓") : "";
  return `<th data-sort="${key}" style="text-align:${align}">${label}${arrow}</th>`;
}

/* ---------- charts ---------- */

function destroyChart(id) {
  if (STATE.charts[id]) {
    STATE.charts[id].destroy();
    delete STATE.charts[id];
  }
}

const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#cbd5e1", font: { size: 11 } } },
    tooltip: {
      backgroundColor: "#0f172a",
      borderColor: "#334155",
      borderWidth: 1,
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
    },
  },
  scales: {
    x: {
      ticks: { color: "#64748b", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      grid: { color: "#1e293b" },
    },
    y: {
      ticks: { color: "#64748b" },
      grid: { color: "#1e293b" },
    },
  },
};

function drawCharts(rows) {
  if (rows.length === 0) return;
  const sorted = [...rows].sort((a, b) =>
    a.webinar_date.localeCompare(b.webinar_date)
  );
  const labels = sorted.map((r) => fmt.dateShort(r.webinar_date));

  // Spend & Cash
  destroyChart("chart-spend-cash");
  STATE.charts["chart-spend-cash"] = new Chart(
    document.getElementById("chart-spend-cash"),
    {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Ad spend",
            data: sorted.map((r) => r.ad_spend),
            borderColor: "#a78bfa",
            backgroundColor: "rgba(167,139,250,0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: "Cash collected",
            data: sorted.map((r) => r.cash_collected),
            borderColor: "#34d399",
            backgroundColor: "rgba(52,211,153,0.08)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
          },
        ],
      },
      options: CHART_BASE,
    }
  );

  // Deals
  destroyChart("chart-deals");
  STATE.charts["chart-deals"] = new Chart(
    document.getElementById("chart-deals"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Deals closed",
            data: sorted.map((r) => r.deals_closed),
            backgroundColor: "#6366f1",
            borderRadius: 4,
          },
        ],
      },
      options: { ...CHART_BASE, plugins: { ...CHART_BASE.plugins, legend: { display: false } } },
    }
  );

  // ROAS
  destroyChart("chart-roas");
  STATE.charts["chart-roas"] = new Chart(
    document.getElementById("chart-roas"),
    {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "ROAS (cash / spend)",
            data: sorted.map((r) => r.roas_cash),
            borderColor: "#fbbf24",
            backgroundColor: "rgba(251,191,36,0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        ...CHART_BASE,
        plugins: { ...CHART_BASE.plugins, legend: { display: false } },
      },
    }
  );

  // Funnel of latest webinar
  destroyChart("chart-funnel");
  const last = sorted[sorted.length - 1];
  STATE.charts["chart-funnel"] = makeFunnelChart(
    document.getElementById("chart-funnel"),
    last,
    fmt.date(last.webinar_date) + " (" + last.webinar_day + ")"
  );
}

function makeFunnelChart(canvas, w, label) {
  const stages = [
    { label: "Page views", value: w.lp_page_views },
    { label: "Opt-ins", value: w.lp_opt_ins },
    { label: "Registered", value: w.total_registrants },
    { label: "Attended", value: w.unique_attendees },
    { label: "Pitched", value: w.pitched_attendees },
    { label: "Booked call", value: w.calls_booked },
    { label: "Held call", value: w.calls_held },
    { label: "Deal closed", value: w.deals_closed },
  ].filter((s) => s.value != null && s.value > 0);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: stages.map((s) => s.label),
      datasets: [
        {
          label,
          data: stages.map((s) => s.value),
          backgroundColor: "#22d3ee",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: !!label, labels: { color: "#cbd5e1", font: { size: 11 } } },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          titleColor: "#e2e8f0",
          bodyColor: "#cbd5e1",
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.dataIndex === 0) return "";
              const prev = stages[ctx.dataIndex - 1].value;
              if (!prev) return "";
              const rate = (ctx.parsed.x / prev) * 100;
              return `${rate.toFixed(1)}% of ${stages[ctx.dataIndex - 1].label}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          beginAtZero: true,
          ticks: { color: "#64748b" },
          grid: { color: "#1e293b" },
        },
        y: {
          type: "category",
          ticks: { color: "#cbd5e1" },
          grid: { display: false },
        },
      },
    },
  });
}

/* ---------- detail page ---------- */

function renderDetail(date) {
  const root = document.getElementById("nm-app");
  const w = STATE.webinars.find((r) => r.webinar_date === date);
  if (!w) {
    root.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        No webinar found for date <code>${escapeHtml(date)}</code>.
        <div class="mt-4"><a href="#/" class="underline text-violet-400">Back to overview</a></div>
      </div>`;
    return;
  }
  document.getElementById("nm-subtitle").textContent =
    fmt.date(w.webinar_date) + " · " + w.webinar_day;

  // Match calls for this webinar
  const callsHere = filterCallsForWebinar(w);

  // Group call stats
  const callStats = computeCallStats(callsHere);

  root.innerHTML = `
    <div class="mb-5 flex items-center justify-between">
      <div>
        <a href="#/" class="text-sm text-violet-400 hover:text-violet-300">&larr; All webinars</a>
        <h2 class="text-2xl font-semibold mt-2">${fmt.date(w.webinar_date)}</h2>
        <div class="flex items-center gap-2 mt-2">
          ${dayPill(w.webinar_day)}
          ${eraPill(w.data_era)}
          ${w.is_legacy ? '<span class="nm-pill nm-pill-legacy">legacy</span>' : ""}
        </div>
      </div>
    </div>

    <!-- Marketing -->
    <h3 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Marketing</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      ${kpi("Ad spend", fmt.money2(w.ad_spend))}
      ${kpi("Impressions", fmt.int(w.meta_impressions))}
      ${kpi("Clicks", fmt.int(w.meta_clicks))}
      ${kpi("Meta CTR", fmt.pct(w.meta_ctr))}
      ${kpi("Meta CVR", fmt.pct(w.meta_cvr))}
      ${kpi("Meta CPL", fmt.money2(w.meta_cpl))}
      ${kpi("Paid CPR", fmt.money2(w.paid_cpr))}
      ${kpi("Blended CPR", fmt.money2(w.blended_cpr))}
      ${kpi("Blended CPA", fmt.money2(w.blended_cpa))}
      ${kpi("Blended CPBC", fmt.money2(w.blended_cpbc))}
      ${kpi("Cost / held call", fmt.money2(w.blended_cost_per_held_call))}
      ${kpi("CAC", fmt.money2(w.cac))}
    </div>

    <!-- Funnel -->
    <h3 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Funnel</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      ${kpi("Page views", fmt.int(w.lp_page_views))}
      ${kpi("Opt-ins", fmt.int(w.lp_opt_ins), fmt.pct(w.lp_opt_in_rate))}
      ${kpi("Form submissions", fmt.int(w.lp_form_submissions))}
      ${kpi("Total registrants", fmt.int(w.total_registrants))}
      ${kpi("Unique attendees", fmt.int(w.unique_attendees), fmt.pct(w.reg_to_attend_rate))}
      ${kpi("Pitched attendees", fmt.int(w.pitched_attendees), fmt.pct(w.attend_to_pitched_rate))}
    </div>

    <h4 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Registration source breakdown</h4>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      ${kpi("Meta", fmt.int(w.meta_registrants))}
      ${kpi("TikTok", fmt.int(w.tiktok_registrants))}
      ${kpi("ManyChat", fmt.int(w.manychat_registrants))}
      ${kpi("Setter", fmt.int(w.setter_registrants))}
      ${kpi("Other / organic", fmt.int(w.other_organic_registrants))}
    </div>

    <!-- Sales -->
    <h3 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Sales</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      ${kpi("Calls booked", fmt.int(w.calls_booked))}
      ${kpi("Active (non-canceled)", fmt.int(w.calls_booked_active))}
      ${kpi("Calls held", fmt.int(w.calls_held))}
      ${kpi("Deposits", fmt.int(w.webinar_deposits))}
      ${kpi("Deals closed", fmt.int(w.deals_closed))}
      ${kpi("Cash collected", fmt.money2(w.cash_collected))}
      ${kpi("Deposit collected", fmt.money2(w.deposit_collected))}
      ${kpi("Revenue generated", fmt.money2(w.revenue_generated))}
      ${kpi("Revenue predicted", fmt.money2(w.revenue_predicted))}
      ${kpi("ROAS (cash)", w.roas_cash == null ? "—" : fmt.ratio(w.roas_cash))}
      ${kpi("ROAS (revenue)", w.roas_revenue == null ? "—" : fmt.ratio(w.roas_revenue))}
      ${kpi("Pitch → book rate", fmt.pct(w.pitch_to_book_rate))}
    </div>

    <!-- Funnel chart -->
    <div class="nm-card p-4 mb-6">
      <h3 class="text-sm font-medium text-slate-300 mb-3">Funnel</h3>
      <div class="h-72"><canvas id="chart-detail-funnel"></canvas></div>
    </div>

    <!-- Calls drill-through -->
    <div class="nm-card p-2 mb-6">
      <div class="px-3 pt-2 pb-1 flex items-center justify-between">
        <h3 class="text-sm font-medium text-slate-300">Calls in this webinar's booking week</h3>
        <span class="text-xs text-slate-500">
          ${callsHere.length} calls &middot;
          ${callStats.held} held &middot;
          ${callStats.deals} deals &middot;
          ${fmt.money(callStats.cash)} cash
        </span>
      </div>
      <div class="px-3 pb-3 text-xs text-slate-500">
        Source: <code>int_calls_enriched</code> filtered by
        <code>booking_week_sun = ${escapeHtml(w.booking_week_sun)}</code> and matching marketing flow.
        ${
          w.is_legacy
            ? "<br><strong>Legacy era</strong> — call-level data not available before 2025-11-23."
            : ""
        }
      </div>
      ${
        callsHere.length === 0
          ? `<div class="px-3 pb-4 text-sm text-slate-500">No call records for this webinar.</div>`
          : `
        <div class="scroll-x">
          <table class="nm-table w-full">
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Closer</th>
                <th>Setter</th>
                <th>Flow</th>
                <th>Call time</th>
                <th>Outcome</th>
                <th>Status</th>
                <th class="text-right">Cash</th>
                <th class="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${callsHere
                .slice()
                .sort((a, b) => {
                  const ta = a.call_date_time || "";
                  const tb = b.call_date_time || "";
                  return tb.localeCompare(ta);
                })
                .map(
                  (c) => `
                <tr>
                  <td>
                    <div class="font-medium">${escapeHtml(c.prospect_name || "—")}</div>
                    <div class="text-xs text-slate-500">${escapeHtml(c.prospect_email_lc || "")}</div>
                  </td>
                  <td>${escapeHtml(c.closer_owner || "—")}</td>
                  <td>${escapeHtml(c.setter_owner || c.calendly_setter_name || "—")}</td>
                  <td><span class="text-xs text-slate-400">${escapeHtml(c.final_marketing_flow || "—")}</span></td>
                  <td>${fmt.dt(c.call_date_time)}</td>
                  <td>${escapeHtml(c.call_outcome || "—")}</td>
                  <td>${callStatusPills(c)}</td>
                  <td class="text-right nm-num">${
                    c.cash_collected ? fmt.money(c.cash_collected) : "—"
                  }</td>
                  <td class="text-right nm-num">${
                    c.revenue_generated ? fmt.money(c.revenue_generated) : "—"
                  }</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      }
    </div>

    <!-- Raw data -->
    <details class="nm-card p-4 mb-6">
      <summary class="cursor-pointer text-sm font-medium text-slate-300">View raw mart row (JSON)</summary>
      <pre class="mt-3 p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-300 overflow-auto">${escapeHtml(
        JSON.stringify(w, null, 2)
      )}</pre>
    </details>
  `;

  drawDetailFunnel(w);
}

function callStatusPills(c) {
  const pills = [];
  if (c.is_deal) pills.push('<span class="nm-pill nm-pill-new">deal</span>');
  if (c.is_deposit && !c.is_deal)
    pills.push('<span class="nm-pill nm-pill-wed">deposit</span>');
  if (c.is_call_held && !c.is_deal && !c.is_deposit)
    pills.push('<span class="nm-pill nm-pill-old">held</span>');
  if (c.not_taken_category)
    pills.push(
      `<span class="nm-pill nm-pill-legacy">${escapeHtml(
        c.not_taken_category.toLowerCase()
      )}</span>`
    );
  return pills.join(" ") || "—";
}

function filterCallsForWebinar(w) {
  // Match calls by booking_week_sun + marketing flow.
  // Per CLAUDE.md the precise Post-Attendee Typeform DOW classification needs
  // calendly_created_ts which isn't snapshotted here — for v0 we attribute
  // typeform calls to BOTH Sun and Wed pages in the same week. Acceptable.
  const week = w.booking_week_sun;
  const day = w.webinar_day;
  return STATE.calls.filter((c) => {
    if (c.booking_week_sun !== week) return false;
    const f = c.final_marketing_flow;
    if (day === "Wednesday") {
      return f === "Wednesday Webinar" || f === "Post-Attendee Webinar Typeform";
    }
    if (day === "Sunday" || day === "Monthly Workshop") {
      return f === "Webinar" || f === "Post-Attendee Webinar Typeform";
    }
    return false; // legacy, no calls
  });
}

function computeCallStats(calls) {
  return {
    held: calls.filter((c) => c.is_call_held).length,
    deals: calls.filter((c) => c.is_deal).length,
    cash: calls.reduce((a, c) => a + (Number(c.cash_collected) || 0), 0),
  };
}

function drawDetailFunnel(w) {
  destroyChart("chart-detail-funnel");
  STATE.charts["chart-detail-funnel"] = makeFunnelChart(
    document.getElementById("chart-detail-funnel"),
    w,
    null
  );
}

/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", render);
