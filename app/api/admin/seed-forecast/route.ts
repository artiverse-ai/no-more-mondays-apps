// Admin-only: seed (or re-seed) a forecast into nmm_calendar.forecast_targets.
//
// POST { forecast_id: 'may-2026-v1' } → builds rows from the matching seed
// module, deletes any existing rows with that forecast_id, and inserts fresh.
// Runs on Vercel so it uses the BQ service account in the env.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { replaceForecast } from "@/lib/forecast-targets-table";
import { buildMay2026Rows, MAY_2026_FORECAST_ID } from "@/lib/forecast-seeds/may-2026";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEEDS: Record<string, (createdBy: string) => Promise<ReturnType<typeof buildMay2026Rows>> | ReturnType<typeof buildMay2026Rows>> = {
  [MAY_2026_FORECAST_ID]: (createdBy) => buildMay2026Rows(createdBy),
};

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { forecast_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const forecastId = body.forecast_id ?? MAY_2026_FORECAST_ID;
  const builder = SEEDS[forecastId];
  if (!builder) {
    return NextResponse.json(
      { error: `No seed registered for forecast_id='${forecastId}'`, available: Object.keys(SEEDS) },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  const rows = await builder(me.email ?? "admin");
  await replaceForecast(forecastId, rows);
  return NextResponse.json({
    forecast_id: forecastId,
    rowsInserted: rows.length,
    durationMs: Date.now() - t0,
  });
}
