// CRUD on the active-closers table that drives the booking dashboard.
//
// The dashboard reads `nmm_calendar.team_members`, which is a view over
// `nmm_calendar.closers` filtered to is_active = TRUE AND
// is_available_to_take_call = TRUE. Editing this table directly (via the
// /admin UI) replaces the prior Google-Sheet → BQ ingest path.

import { bq } from "./bq";

export type Closer = {
  email: string;
  is_active: boolean;
  is_available_to_take_call: boolean;
};

export type CloserFlag = "is_active" | "is_available_to_take_call";

// Hard-coded table reference. Always use the production BQ project regardless
// of BQ_PROJECT / BQ_DATASET env vars, because the booking dashboard reads
// from this exact location.
const TABLE = "`no-more-mondays-analytics.nmm_calendar.closers`";

function normEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) throw new Error("Invalid email");
  return e;
}

export async function getClosers(): Promise<Closer[]> {
  const [rows] = await bq().query({
    query: `SELECT email, is_active, is_available_to_take_call
            FROM ${TABLE}
            ORDER BY email`,
  });
  return (rows as Array<{
    email: string;
    is_active: boolean | null;
    is_available_to_take_call: boolean | null;
  }>).map((r) => ({
    email: r.email,
    is_active: r.is_active === true,
    is_available_to_take_call: r.is_available_to_take_call === true,
  }));
}

export async function addCloser(email: string): Promise<void> {
  const norm = normEmail(email);
  // MERGE so calling addCloser on an already-existing email is a no-op rather
  // than an error — keeps the UI forgiving without an explicit pre-check.
  await bq().query({
    query: `MERGE ${TABLE} t
            USING (SELECT @email AS email) s
            ON t.email = s.email
            WHEN NOT MATCHED THEN
              INSERT (email, is_active, is_available_to_take_call)
              VALUES (@email, TRUE, TRUE)`,
    params: { email: norm },
    types: { email: "STRING" },
  });
}

export async function setCloserFlag(
  email: string,
  field: CloserFlag,
  value: boolean,
): Promise<void> {
  // Whitelist the column name — we can't parameterize identifiers in SQL.
  if (field !== "is_active" && field !== "is_available_to_take_call") {
    throw new Error("Invalid field");
  }
  await bq().query({
    query: `UPDATE ${TABLE} SET ${field} = @value WHERE email = @email`,
    params: { email: normEmail(email), value },
    types: { email: "STRING", value: "BOOL" },
  });
}

export async function removeCloser(email: string): Promise<void> {
  await bq().query({
    query: `DELETE FROM ${TABLE} WHERE email = @email`,
    params: { email: normEmail(email) },
    types: { email: "STRING" },
  });
}
