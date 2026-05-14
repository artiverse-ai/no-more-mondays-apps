// Comments / "solutions" posted on the weekly-report dashboard.
// Marketing tab: only the configured marketing editor (Alvero) can post.
// Sales tab: only the sales editor (Ben) can post.
// Everyone signed in can read.
//
// Storage: BigQuery `nmm_calendar.weekly_report_solutions`. Low-volume
// table (a few rows per week max) — BQ DML latency is fine for the
// workflow.

import { bq, table } from "./bq";

export type SolutionTab = "marketing" | "sales";

export type Solution = {
  id: string;
  reportWeek: string; // e.g. "2026-05-03"
  tab: SolutionTab;
  authorEmail: string;
  authorName: string | null;
  body: string;
  createdAt: string; // ISO
  updatedAt: string | null; // ISO if edited, null if never edited
};

const TABLE = table("weekly_report_solutions");

// Editor emails — overridable via env so we don't have to redeploy to change.
// Default to the names the user gave us.
export const MARKETING_EDITOR = (
  process.env.MARKETING_SOLUTIONS_EDITOR ?? "alvaro@nomoremondays.io"
).toLowerCase();
export const SALES_EDITOR = (
  process.env.SALES_SOLUTIONS_EDITOR ?? "ben@nomoremondays.io"
).toLowerCase();

export function editorFor(tab: SolutionTab): string {
  return tab === "marketing" ? MARKETING_EDITOR : SALES_EDITOR;
}

let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  await bq().query({
    query: `CREATE TABLE IF NOT EXISTS ${TABLE} (
      id STRING NOT NULL,
      report_week STRING NOT NULL,
      tab STRING NOT NULL,
      author_email STRING NOT NULL,
      author_name STRING,
      body STRING NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      deleted_at TIMESTAMP
    )`,
  });
  // Idempotent migration for instances that were created before updated_at
  // existed. Safe to run every cold start — IF NOT EXISTS is a no-op when
  // the column is already there.
  await bq().query({
    query: `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`,
  });
  _tableReady = true;
}

type RawSolutionRow = {
  id: string;
  report_week: string;
  tab: SolutionTab;
  author_email: string;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string | null;
};

function rowToSolution(r: RawSolutionRow): Solution {
  return {
    id: r.id,
    reportWeek: r.report_week,
    tab: r.tab,
    authorEmail: r.author_email,
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_FIELDS = `id, report_week, tab, author_email, author_name, body,
       FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at, 'UTC') AS created_at,
       FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at, 'UTC') AS updated_at`;

export async function listSolutions(
  reportWeek: string,
  tab: SolutionTab,
): Promise<Solution[]> {
  await ensureTable();
  const [rows] = await bq().query({
    query: `SELECT ${SELECT_FIELDS}
            FROM ${TABLE}
            WHERE report_week = @week AND tab = @tab AND deleted_at IS NULL
            ORDER BY created_at DESC`,
    params: { week: reportWeek, tab },
    types: { week: "STRING", tab: "STRING" },
  });
  return (rows as RawSolutionRow[]).map(rowToSolution);
}

export async function createSolution(opts: {
  reportWeek: string;
  tab: SolutionTab;
  authorEmail: string;
  authorName: string | null;
  body: string;
}): Promise<Solution> {
  await ensureTable();
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  await bq().query({
    query: `INSERT INTO ${TABLE} (id, report_week, tab, author_email, author_name, body, created_at)
            VALUES (@id, @week, @tab, @email, @name, @body, TIMESTAMP(@now))`,
    params: {
      id,
      week: opts.reportWeek,
      tab: opts.tab,
      email: opts.authorEmail.toLowerCase(),
      name: opts.authorName,
      body: opts.body,
      now: nowIso,
    },
    types: {
      id: "STRING",
      week: "STRING",
      tab: "STRING",
      email: "STRING",
      name: "STRING",
      body: "STRING",
      now: "STRING",
    },
  });
  return {
    id,
    reportWeek: opts.reportWeek,
    tab: opts.tab,
    authorEmail: opts.authorEmail.toLowerCase(),
    authorName: opts.authorName,
    body: opts.body,
    createdAt: nowIso,
    updatedAt: null,
  };
}

export async function updateSolution(
  id: string,
  body: string,
): Promise<Solution | null> {
  await ensureTable();
  await bq().query({
    query: `UPDATE ${TABLE}
            SET body = @body, updated_at = CURRENT_TIMESTAMP()
            WHERE id = @id AND deleted_at IS NULL`,
    params: { id, body },
    types: { id: "STRING", body: "STRING" },
  });
  return getSolution(id);
}

export async function softDeleteSolution(id: string): Promise<void> {
  await ensureTable();
  await bq().query({
    query: `UPDATE ${TABLE} SET deleted_at = CURRENT_TIMESTAMP() WHERE id = @id`,
    params: { id },
    types: { id: "STRING" },
  });
}

export async function getSolution(id: string): Promise<Solution | null> {
  await ensureTable();
  const [rows] = await bq().query({
    query: `SELECT ${SELECT_FIELDS}
            FROM ${TABLE}
            WHERE id = @id AND deleted_at IS NULL
            LIMIT 1`,
    params: { id },
    types: { id: "STRING" },
  });
  const r = (rows as RawSolutionRow[])[0];
  if (!r) return null;
  return rowToSolution(r);
}
