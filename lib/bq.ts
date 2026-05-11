import { BigQuery } from "@google-cloud/bigquery";

export const BQ_PROJECT = process.env.BQ_PROJECT ?? "no-more-mondays-analytics";
export const BQ_DATASET = process.env.BQ_DATASET ?? "nmm_calendar";

let _client: BigQuery | null = null;

/**
 * Returns a singleton BigQuery client.
 *
 * Locally: relies on Application Default Credentials
 *   (`gcloud auth application-default login`).
 * On Vercel / any CI: set `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the full
 *   service-account JSON (paste the key file contents into the env var).
 */
export function bq(): BigQuery {
  if (_client) return _client;

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credsJson) {
    const credentials = JSON.parse(credsJson);
    _client = new BigQuery({
      projectId: BQ_PROJECT,
      credentials,
    });
  } else {
    _client = new BigQuery({ projectId: BQ_PROJECT });
  }
  return _client;
}

export function table(name: string): string {
  return `\`${BQ_PROJECT}.${BQ_DATASET}.${name}\``;
}
