"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryMessageRiskData = queryMessageRiskData;
const pg_1 = require("pg");
let pool = null;
function getVaslPool() {
    const url = process.env.DATABASE_URL_VASL;
    if (!url) {
        return null;
    }
    if (!pool) {
        pool = new pg_1.Pool({ connectionString: url });
    }
    return pool;
}
/** Query inference risk for coach message ids from the vasl database. */
async function queryMessageRiskData(messageIds) {
    if (messageIds.length === 0)
        return [];
    const client = getVaslPool();
    if (!client) {
        console.warn("[vaslDb] DATABASE_URL_VASL is not set — skipping risk lookup");
        return [];
    }
    const { rows } = await client.query(`SELECT 
      ie.original_source_id,
      ie.risk_tier,
      ie.risk_score,
      array_agg(es.signal_code ORDER BY es.confidence DESC) as signal_codes
    FROM inference_events ie
    LEFT JOIN event_signals es ON es.event_id = ie.id
    WHERE ie.original_source_id = ANY($1::text[])
    GROUP BY ie.original_source_id, ie.risk_tier, ie.risk_score`, [messageIds]);
    return rows.map((row) => ({
        ...row,
        risk_score: typeof row.risk_score === "string" ? parseFloat(row.risk_score) : row.risk_score,
        signal_codes: normalizeSignalCodes(row.signal_codes),
    }));
}
function normalizeSignalCodes(raw) {
    if (!raw)
        return [];
    return raw.filter((c) => typeof c === "string" && c.length > 0);
}
