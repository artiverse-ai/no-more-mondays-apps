# NMM SOP Export → Notion

11 markdown files, one per SOP. Each file contains **only the body content** —
no frontmatter, no metadata — so you can:

1. Open the file in **Quick Look** (select in Finder + press Space) or VS Code
2. **Cmd+A** → **Cmd+C** to copy all
3. In Notion's **Master SOP Hub** database, click into the body of the matching
   row and **Cmd+V** — Notion converts the markdown to proper headings, bullets,
   callouts, and code blocks automatically
4. Set the row's **Department** and **Status** properties per the table below

## Row properties to set

| # | File | SOP Title (for the row) | Department | Status |
|---|------|-------------------------|------------|--------|
| 01 | `01-weekly-report.md` | Weekly Report — Monday recap & Thursday midweek | App/Dashboard | Active |
| 02 | `02-high-level-dashboard.md` | High-Level (CEO) dashboard | App/Dashboard | Active |
| 03 | `03-sales-performance-dashboard.md` | Sales (Closer) Performance dashboard | App/Dashboard | Active |
| 04 | `04-setter-performance-dashboard.md` | Setter Performance dashboard | App/Dashboard | Active |
| 05 | `05-webinar-performance-dashboard.md` | Webinar Performance dashboard | App/Dashboard | Active |
| 06 | `06-solutions-tabs.md` | Filling in the Solutions tabs (Alvaro & Ben) | Reporting | Active |
| 07 | `07-funnel-search.md` | Funnel Search | App/Dashboard | Active |
| 08 | `08-capacity-dashboard.md` | How to read the capacity dashboard | App/Dashboard | Active |
| 09 | `09-closer-calendar-management.md` | Calendar management for closers | Operations | Active |
| 10 | `10-new-closer-joins.md` | When a new closer joins | Operations | Active |
| 11 | `11-closer-removed.md` | When a closer is removed | Operations | Active |

## A note on the existing "Weekly Report — Monday recap & Thursday midweek check" row

You already created this row empty. Just open it and paste the body of
`01-weekly-report.md` into it. Then set Department = `App/Dashboard` and
Status = `Active`.

## Re-syncing later

When a web SOP changes, rebuild this directory:

```bash
# (Not yet wired — for now treat these markdown files as the canonical
# Notion versions and edit them directly in Notion going forward.)
```

The web `/sops` pages will be replaced with a redirect to the Notion hub once
you've finished the import. That ships in a separate PR.
