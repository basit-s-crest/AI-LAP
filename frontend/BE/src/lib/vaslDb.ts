import { Pool } from "pg";

let pool: Pool | null = null;

function getVaslPool(): Pool | null {
  const url = process.env.DATABASE_URL_VASL || process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  if (!pool) {
    const connectionString = url.replace("pgbouncer=true", "pgbouncer=false");
    pool = new Pool({ connectionString });
  }
  return pool;
}

export interface MessageRiskRow {
  original_source_id: string;
  risk_tier: string;
  risk_score: number;
  signal_codes: string[] | null;
}

/** Query inference risk for coach message ids from the vasl database. */
export async function queryMessageRiskData(
  messageIds: string[]
): Promise<MessageRiskRow[]> {
  if (messageIds.length === 0) return [];

  const client = getVaslPool();
  if (!client) {
    console.warn("[vaslDb] DATABASE_URL_VASL is not set — skipping risk lookup");
    return [];
  }

  const { rows } = await client.query<MessageRiskRow>(
    `SELECT 
      ie.original_source_id,
      ie.risk_tier,
      ie.risk_score,
      array_agg(es.signal_code ORDER BY es.confidence DESC) as signal_codes
    FROM inference_events ie
    LEFT JOIN event_signals es ON es.event_id = ie.id
    WHERE ie.original_source_id = ANY($1::text[])
    GROUP BY ie.original_source_id, ie.risk_tier, ie.risk_score`,
    [messageIds]
  );

  return rows.map((row) => ({
    ...row,
    risk_score: typeof row.risk_score === "string" ? parseFloat(row.risk_score) : row.risk_score,
    signal_codes: normalizeSignalCodes(row.signal_codes),
  }));
}

function normalizeSignalCodes(raw: string[] | null | undefined): string[] {
  if (!raw) return [];
  return raw.filter((c): c is string => typeof c === "string" && c.length > 0);
}
