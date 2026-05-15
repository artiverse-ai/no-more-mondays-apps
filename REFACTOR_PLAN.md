# Weekly Report Refactor Plan

Implementing the spec in `weekly_report_build_guide.md` + `weekly_report_metrics_sql_reference.md`
on top of our existing tech stack (Next.js 16, React 19, TypeScript, Tailwind v4 + CSS modules,
BigQuery via @google-cloud/bigquery, VM-based AI insight generator).

---

## What MUST stay exactly as it is

These are user-locked invariants for the refactor:

1. **Marketing Solutions tab** (Monday tab 5) — Alvaro posts, alvaro@nomoremondays.io editor allowlist, BQ-backed via `weekly_report_solutions`
2. **Sales Solutions tab** (Monday tab 6) — Ben posts, ben@nomoremondays.io editor allowlist, same backing
3. **Cascade-delete behavior** — deleting a snapshot soft-deletes its insights + solutions
4. **AI insight generation pipeline** — VM cron, hybrid Haiku→Sonnet retry, race-condition guards, status timeout self-heal, GitHub Action auto-deploy. The DATA we feed Claude changes; the orchestration doesn't.
5. **Snapshot creation flow** — admin clicks "+ Create Next Snapshot" → row created in `pending` → wrapper picks up ≤10s → cards atomically appear when status flips to `succeeded`. UX expectation unchanged.

---

## What the new spec requires (summary of the build guide)

### Structural changes

| Today | New spec |
|---|---|
| Both modes render same 5 tabs | Monday = **6 tabs**, Thursday = **3 tabs** |
| Tab 1 = Latest Webinar | New Tab 1 = **Overview** (4 sections A·B·C·D — entirely new) |
| Tab 2 = Last Week's Sales | New Tab 2 = **Latest Webinar** (similar to current Tab 1 but reorganized) |
| Tab 3 = Strategic Insights | Tab 3 (Mon) = **Last Week's Sales** (similar to current Tab 2) · Tab 3 (Thu) = **AI Strategic Insights** |
| (no equivalent) | New **persistent KPI strip** sticky on every tab — 5 cards (2 webinar + 3 company) |

### Visual changes

- **LIGHT theme** (bg=#ffffff). Current is dark. This is the biggest visual shift.
- New CSS tokens documented in §2 of the build guide
- SF Pro / SF Mono fonts (currently we use Syne/Outfit/JetBrains Mono — those are stylistically similar, I'll keep our font stack but apply tabular-nums + the same letter-spacing rules)
- New mobile breakpoints (max-width 900px collapse to single column; max-width 768px full mobile treatment)

### Data changes (new BQ tables/fields we'll fetch)

| Table | What we'll pull |
|---|---|
| `mart_high_level_daily` | Section A money + cycle aggregates (cash, TCV, ROAS, AOV, ACV, PIF rate, ad spend, deals, calls booked) |
| `stg_fanbasis_sales` | **The new cash source** — NOT int_calls_enriched.cash_collected. Status='succeeded' filter. |
| `stg_meta_campaigns` | Per-campaign Meta data with Frequency column |
| `stg_ghl_weekly_webinar_regs` | Lead-creation date for the time-to-book calc on setter performance |
| `mart_webinar_events` | Expanded set of fields for Tab 2 top-of-funnel + reactivation funnel |
| `int_calls_enriched` | Section C funnel + closer/booking-mode/setter splits + cycle queries (OCC/FUC median + average) |

### KPI strip metrics (5 cards on every tab)

1. **Avg Webinar Show Rate** (target 24%) — weighted Zoom-attend across the prev Sun-Sat
2. **% Tier 1 Leads** (N/A placeholder — denominator not yet in mart)
3. **Blended Cash ROAS** (target 4×) — Fanbasis cash / total Meta spend
4. **CPL Blended** (N/A placeholder — open denominator question)
5. **Cash / Booked Call (DPC)** — Fanbasis cash / total calls booked

### Comparison-group logic on Tab 2

| Mode | Latest column | Comparison columns |
|---|---|---|
| Monday | `latest_sun` | prior Wed (`-4d`) · prior Sun (`-7d`) |
| Thursday | `latest_wed` | prior Sun (`-3d`) · prior Wed (`-7d`) |

(Current code uses same-weekday-only filter for midweek. Replacing with the explicit IN-list per the spec.)

---

## Files to create / modify

### Modify

- `app/dashboards/weekly-report/[slug]/page.tsx` — rewrite to render new tab structure based on `snapshot.reportType`
- `app/dashboards/weekly-report/_components/report.module.css` — replace dark-theme tokens with light-theme tokens per §2; extend with new section classes
- `lib/weekly-report-bq.ts` — add new fetchers (KPI strip, Section A/B/C, Meta campaigns, setter+TTB, cycle times, comparison-with-new-IN-list)
- `data_audit/weekly_insights/bq_data.py` — extend `assemble_report_payload` with the new data shape so Claude sees what dashboards see
- `prompts/weekly_insights.md` — likely split into `prompts/monday.md` + `prompts/thursday.md` (Thursday is marketing-focused; Monday is full company scope)

### Create

- `_components/PersistentKpiStrip.tsx` — sticky strip, 5 cards, 2-webinar + 3-company groups
- `_components/Tab1Overview/`
  - `index.tsx` (renders sections A/B/C/D)
  - `SectionAOverallCompany.tsx` — 10 money cards + 4 cycle cards
  - `SectionBMarketingEfficiency.tsx` — 5 cards
  - `SectionCSalesEfficiency.tsx` — funnel diagram + 4 rate cards + 6 efficiency cards
  - `SectionDPerPersonKpis.tsx` — placeholder
- `_components/Tab2LatestWebinar.tsx` — banner-info + ctx-banner + top-of-funnel + channel mix + meta campaigns + reactivation funnel + banner-warn
- `_components/Tab3LastWeekSales.tsx` (Monday only) — funnel diagram + WoW comp + closer overall + booking mode + setter perf w/ time-to-book
- `_components/KpiMiniCard.tsx` — reusable mini card with emoji prefix
- `_components/FunnelDiagram.tsx` — reusable horizontal funnel (used in Section C + Tab 3)
- `_components/MetaCampaignsTable.tsx` — per-campaign table with Frequency
- `_components/ChannelMixBars.tsx` + `_components/ChannelMixTrend.tsx`

### Keep as-is

- `_components/InsightsEditor.tsx` → renames internally to "AI Strategic Insights" but the cards are identical. Just gets a `.ai-badge` header.
- `_components/SolutionsTab.tsx` — untouched
- `_components/ContextBannerEditor.tsx` — extends to support `.banner-info` and `.banner-warn` variants too (3 kinds instead of 2)
- `_components/Tooltip.tsx` — the new spec's tooltip system is functionally identical to ours
- `_components/Tabs.tsx` — drives the new 6-vs-3 layout via conditional tab array

---

## Phased implementation (incrementally shippable)

Each phase is a working state — we can deploy and verify before moving on.

| Phase | Scope | Est. time | Shippable? |
|---|---|---|---|
| **0** | Verify BQ field names match spec; confirm light theme decision; align on phases | 30 min | n/a |
| **1** | Add ALL new BQ fetchers in `lib/weekly-report-bq.ts` using the spec's exact SQL. Unit-test each by hitting BQ. No UI changes yet. | 2 hours | Y (no-op deploy) |
| **2** | Apply new light-theme CSS tokens to `report.module.css`. Existing dashboard now looks light but otherwise unchanged. | 1 hour | Y |
| **3** | Build `PersistentKpiStrip` component and wire onto the existing page (sticky top, above current tabs). All 5 cards. | 2 hours | Y |
| **4** | Build Tab 1 Overview from scratch — Section A money + cycle cards. Inject as new "Overview" tab in the existing layout. Tabs become 6 (Mon) or 4 (Thu). | 3 hours | Y |
| **5** | Add Section B (marketing efficiency) + Section C (funnel + rates + efficiency) + Section D (placeholder). | 3 hours | Y |
| **6** | Rebuild Tab 2 Latest Webinar with new ordering: banner-info → ctx-banner → top-of-funnel → channel mix → channel mix trend → meta campaigns → reactivation funnel → banner-warn. Add the new Meta campaigns table with Frequency column. Update comparison-group IN-list logic. | 4 hours | Y |
| **7** | Rebuild Tab 3 Last Week's Sales (Monday only) — funnel + WoW comp + closer overall + booking mode + setter perf w/ time-to-book. Hide on Thursday. | 2 hours | Y |
| **8** | Rename old Tab 3 to "AI Strategic Insights"; add `.ai-badge` header. Card pattern is unchanged. | 30 min | Y |
| **9** | Solutions tabs preserved as-is — verify they still render in Monday position 5/6. | 15 min | Y |
| **10** | Update `data_audit/weekly_insights/bq_data.py::assemble_report_payload` to include all new fields. Update prompt template (or split Mon/Thu). Test a snapshot regeneration end-to-end. | 2 hours | Y |
| **11** | Mobile pass — test golden path Tab 1 → Tab 3 on iPhone Safari per spec §19. Fix any breakpoint issues. | 1 hour | Y |
| **12** | Final integration test — delete existing 2026-05-14 snapshot, recreate, watch full flow. Confirm AI insights still generate, Solutions tabs editable, no regressions. | 30 min | Y |

**Total: ~22 hours of focused work**, but each phase is independently shippable so we don't end up with a half-finished rewrite stuck in a branch.

---

## Open questions for you before I start

1. **Theme**: spec is light (`bg=#ffffff`), current is dark. Confirm we follow the spec (light)?
2. **Existing snapshots**: 2026-05-03 (Mon) and 2026-05-14 (Thu) exist in BQ. Once new code ships, should they auto-render in the new format (snapshot row data is forward-compatible since they don't store rendered HTML, just metadata + AI banners)? Or do we mark them legacy?
3. **Fonts**: spec wants SF Pro / SF Mono. We have Syne/Outfit/JetBrains Mono. Keep our fonts and just match weights/sizes/letter-spacing, or switch to SF Pro? (Keeping ours is faster and visually consistent with the rest of the app.)
4. **Tab 4 → renamed Tab 3 on Thursday**: confirm Thursday Tab 3 is the AI Strategic Insights tab (i.e., we skip the "Last Week's Sales" tab entirely on Thursday).
5. **% Tier 1 Leads + CPL Blended placeholders**: render as `"N/A"` with target text only? Per spec §2.2, §2.4 — confirm.
6. **Section D Per-Person KPIs**: render the dashed placeholder card with "Owner: Marek" text. Confirm.

Once you sign off on these answers + the phasing, I'll start Phase 1.
