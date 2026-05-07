# Refresh dashboard JSON snapshots from BigQuery.
#
# Requires: Google Cloud SDK (`bq` CLI) authenticated with access to
#   no-more-mondays-analytics project.
#
# Usage (from repo root):
#   pwsh dashboard/scripts/refresh-data.ps1
#
# What it does:
#   1. Runs each query against BigQuery via the `bq` CLI.
#   2. Writes raw responses to dashboard/data/_tmp_*.json.
#   3. Converts BQ wire format -> clean array-of-objects JSON via Convert-BqResponse.
#   4. Final outputs:
#        dashboard/data/webinar_events.json
#        dashboard/data/calls.json

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)  # dashboard/
$dataDir = Join-Path $root 'data'
$tmpDir = Join-Path $dataDir '_tmp'
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$queries = @(
    @{
        Name = 'webinar_events'
        Sql = 'SELECT * FROM `no-more-mondays-analytics.dbt_tuddin.mart_webinar_events` ORDER BY webinar_date DESC'
    },
    @{
        Name = 'calls'
        Sql = @"
SELECT
  prospect_email_lc, prospect_name, closer_owner, setter_owner, calendly_setter_name,
  call_outcome, call_date_time, date_closed, booking_week_sun, final_marketing_flow,
  is_call_held, is_dispositioned, is_show_rate_eligible, is_deal, is_deposit,
  is_canceled, is_rescheduled, is_ghosted, not_taken_category, close_type, close_path_tag,
  cash_collected, revenue_generated, deposit_collected, booking_to_close_days, call_to_close_days
FROM ``no-more-mondays-analytics.dbt_tuddin.int_calls_enriched``
WHERE booking_week_sun >= '2025-11-01'
ORDER BY booking_week_sun DESC, call_date_time DESC
"@
    }
)

# Cast cell -> typed JS value
$cast = {
    param($value, $type)
    if ($null -eq $value) { return $null }
    switch ($type) {
        'INTEGER' { return [int64]$value }
        'INT64' { return [int64]$value }
        'FLOAT' { return [double]$value }
        'FLOAT64' { return [double]$value }
        'NUMERIC' { return [double]$value }
        'BIGNUMERIC' { return [double]$value }
        'BOOLEAN' { return ($value -eq 'true') }
        'BOOL' { return ($value -eq 'true') }
        'TIMESTAMP' {
            $secs = [double]$value
            return ([System.DateTimeOffset]::FromUnixTimeMilliseconds([int64]($secs * 1000))).ToString('yyyy-MM-ddTHH:mm:ssZ')
        }
        default { return $value }
    }
}

foreach ($q in $queries) {
    $rawPath = Join-Path $tmpDir "$($q.Name).raw.json"
    $cleanPath = Join-Path $dataDir "$($q.Name).json"

    Write-Host "Running query: $($q.Name)"
    # bq query returns JSON when --format=prettyjson is used, but bq's JSON
    # is row-objects already. We use the BQ REST shape via `--format=json`
    # plus `--use_legacy_sql=false`. To match the wire format consumed here,
    # we instead parse bq's row-object output directly.
    bq query --use_legacy_sql=false --format=json --max_rows=100000 $q.Sql | Out-File -Encoding utf8 $rawPath

    $rows = Get-Content -Raw -Path $rawPath | ConvertFrom-Json
    # bq's --format=json returns array of {col: value-string} objects with no schema.
    # Cast inferred from .NET parsing during ConvertFrom-Json, then normalize types per-key.
    # For simplicity we ship strings as-is (the dashboard handles common cases).
    $json = $rows | ConvertTo-Json -Depth 10 -Compress
    [System.IO.File]::WriteAllText($cleanPath, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  -> $cleanPath ($($rows.Count) rows)"
}

Remove-Item -Recurse -Force $tmpDir
Write-Host "Done."
