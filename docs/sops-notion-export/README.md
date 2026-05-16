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

---

## For Claude (when run via Notion MCP in a fresh session)

> Read this if the user asks you to sync SOPs to Notion and you have
> `mcp__notion__*` tools available.

**Goal:** Push all 11 markdown files in this directory into the **Master SOP
Hub** Notion database. Either update existing rows (matched by title) or
create new ones.

**Notion database ID:** `28c9b9a6796a80348e29e76145bdf1c7`
(URL: `notion.so/nomoremondays/28c9b9a6796a80348e29e76145bdf1c7`)

**Workflow:**

1. **Introspect the database first** — list its properties to discover:
   - The Department select options (so you don't create lowercase duplicates).
     Expected values: `Marketing`, `Operations`, `App/Dashboard`, plus `Reporting`
     which you may need to create.
   - The Status options (expected: `Active`).
   - Whether Department is single-select or multi-select.

2. **Query existing rows** to find anything that matches the SOP titles below.
   If you find a match, **update** the row (overwrite body, set properties).
   If not, **create** a fresh row.

3. **For each row, set:**
   - `SOP Title` → the title in the table below
   - `Department` → the tag in the table below
   - `Status` → `Active`
   - The page body (children blocks) → the content of the matching `.md` file
     in this directory. Convert markdown to Notion blocks:
     - `**bold**` → bold annotation
     - `## heading` → `heading_2`
     - `- bullet` → `bulleted_list_item`
     - `1. item` → `numbered_list_item`
     - `> 💡 **Tip:** ...` → `callout` block with light_gray background + 💡 icon
     - `> **Why:** ...` → `callout` block with light_gray background + ❓ icon
     - ` ```code``` ` → `code` block
     - Links: `[text](url)` → text with link annotation

4. **Report back** with a summary: X rows updated, Y rows created, any errors.

**Title → Department mapping (matches the property table above):**

| File | Title | Department |
|------|-------|------------|
| 01-weekly-report.md | Weekly Report — Monday recap & Thursday midweek | App/Dashboard |
| 02-high-level-dashboard.md | High-Level (CEO) dashboard | App/Dashboard |
| 03-sales-performance-dashboard.md | Sales (Closer) Performance dashboard | App/Dashboard |
| 04-setter-performance-dashboard.md | Setter Performance dashboard | App/Dashboard |
| 05-webinar-performance-dashboard.md | Webinar Performance dashboard | App/Dashboard |
| 06-solutions-tabs.md | Filling in the Solutions tabs (Alvaro & Ben) | Reporting |
| 07-funnel-search.md | Funnel Search | App/Dashboard |
| 08-capacity-dashboard.md | How to read the capacity dashboard | App/Dashboard |
| 09-closer-calendar-management.md | Calendar management for closers | Operations |
| 10-new-closer-joins.md | When a new closer joins | Operations |
| 11-closer-removed.md | When a closer is removed | Operations |

**Special case:** A row titled "Weekly Report — Monday recap & Thursday
midweek check" may already exist (created manually before the sync). Match
on case-insensitive title containing "weekly report" and update that row
instead of creating a duplicate.
