"""
seed_generator.py
-----------------
Generates migrations/V9__seed_1000_events.sql

Strategy: use a temp mapping table to resolve member_token → id
cleanly, then INSERT all child rows using integer IDs directly.
This avoids thousands of correlated subqueries that crash Postgres.

Run:
    python seed_generator.py
    # writes ../migrations/V9__seed_1000_events.sql
"""

import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(42)

# ── Reference data ─────────────────────────────────────────────────────────────

ORGS = [
    "org_univ_maryland",
    "org_howard_university",
    "org_spelman_college",
    "org_community_health_dc",
    "org_pride_center_la",
]

THERAPISTS = {
    "org_univ_maryland":       ["thr_001", "thr_002"],
    "org_howard_university":   ["thr_003", "thr_004"],
    "org_spelman_college":     ["thr_005", "thr_006"],
    "org_community_health_dc": ["thr_007", "thr_008"],
    "org_pride_center_la":     ["thr_009", "thr_010"],
}

GROUPS = [
    "grp_healing_community", "grp_black_excellence",
    "grp_queer_youth_safe_space", "grp_first_gen_support",
    "grp_anxiety_warriors", "grp_grief_circle",
    "grp_trans_affirming", "grp_bipoc_wellness",
]

INSTRUMENTS = ["PHQ8", "GAD7", "ACES"]

SIGNALS = {
    "HOP-01": ("Direct hopelessness",           "hopelessness"),
    "HOP-02": ("Worthlessness expression",       "hopelessness"),
    "HOP-03": ("Indirect hopelessness",          "hopelessness"),
    "HOP-04": ("No future orientation",          "hopelessness"),
    "HOP-05": ("Futility expression",            "hopelessness"),
    "HOP-06": ("Giving up language",             "hopelessness"),
    "HOP-07": ("Performative positivity mask",   "hopelessness"),
    "HOP-08": ("Existential despair",            "hopelessness"),
    "ISO-01": ("Direct social withdrawal",       "isolation"),
    "ISO-02": ("Disconnection from community",   "isolation"),
    "ISO-03": ("Feeling invisible",              "isolation"),
    "ISO-04": ("Unseen/unchecked",               "isolation"),
    "ISO-05": ("Loneliness expression",          "isolation"),
    "ISO-06": ("Peer rejection",                 "isolation"),
    "ISO-07": ("Family disconnection",           "isolation"),
    "ISO-08": ("Community rejection",            "isolation"),
    "ISO-09": ("Digital isolation",              "isolation"),
    "SHA-01": ("Direct self-harm reference",     "self_harm"),
    "SHA-02": ("Indirect self-harm reference",   "self_harm"),
    "SHA-03": ("Coded ideation",                 "self_harm"),
    "SHA-04": ("Method reference",               "self_harm"),
    "SHA-05": ("Pain expression",                "self_harm"),
    "SHA-06": ("Indirect method reference",      "self_harm"),
    "SHA-07": ("Passive ideation",               "self_harm"),
    "CRS-01": ("Acute distress marker",          "crisis"),
    "CRS-02": ("Time-bounding",                  "crisis"),
    "CRS-03": ("Urgency language",               "crisis"),
    "CRS-04": ("Method reference",               "crisis"),
    "CRS-05": ("Farewell pattern",               "crisis"),
    "CRS-06": ("Sudden positive shift",          "crisis"),
    "CCM-01": ("AAVE register",                  "cultural"),
    "CCM-02": ("Code-switching",                 "cultural"),
    "CCM-03": ("Youth slang",                    "cultural"),
    "CCM-04": ("Minimization",                   "cultural"),
    "CCM-05": ("Performative strength",          "cultural"),
    "CCM-06": ("Indirect disclosure",            "cultural"),
    "CCM-07": ("First-gen stressor",             "cultural"),
    "CCM-08": ("Immigration stressor",           "cultural"),
    "CCM-09": ("Code-switching marker",          "cultural"),
    "CCM-10": ("Anti-LGBTQ+ stressor",           "cultural"),
    "CCM-11": ("Political stressor",             "cultural"),
    "CCM-12": ("Religious conflict stressor",    "cultural"),
}

SHAP_SPANS = {
    "HOP-01": ["there is no point",     "nothing matters anymore",   "why even bother"],
    "HOP-02": ["i am worthless",         "feel like a burden",        "nobody needs me"],
    "HOP-03": ["cant keep doing this",   "idk why i try",             "whats even the point"],
    "HOP-04": ["no future for me",       "cant see tomorrow",         "nothing to look forward"],
    "HOP-05": ["its all pointless",      "nothing ever changes",      "always the same"],
    "HOP-06": ["giving up on this",      "done trying anymore",       "cant do it"],
    "HOP-07": ["everything is fine now", "im totally over it",        "all good now"],
    "HOP-08": ["what is even life",      "existence feels heavy",     "why am i here"],
    "ISO-01": ["staying in my room",     "not going out anymore",     "avoiding everyone"],
    "ISO-02": ["disconnected from everyone","feel so far away",       "not part of anything"],
    "ISO-03": ["nobody sees me",         "feel invisible here",       "like i dont exist"],
    "ISO-04": ["nobody checks on me",    "nobody ever asks",          "always alone tbh"],
    "ISO-05": ["so lonely lately",       "miss having people",        "nobody to talk to"],
    "ISO-06": ["they dont want me",      "pushed out of the group",   "left out again"],
    "ISO-07": ["family doesnt get me",   "parents dont understand",   "home feels cold"],
    "ISO-08": ["community rejected me",  "they dont accept me",       "not welcome here"],
    "ISO-09": ["even online alone",      "no one replies anymore",    "ghosted by everyone"],
    "SHA-01": ["been hurting myself",    "cut again last night",      "cant stop hurting"],
    "SHA-02": ["thinking about it",      "the thoughts are back",     "hard to explain"],
    "SHA-03": ["thinking about unaliving","want to end it",           "make it all stop"],
    "SHA-04": ["know how id do it",      "have a plan already",       "thought it through"],
    "SHA-05": ["pain wont stop",         "hurts all the time",        "cant take the pain"],
    "SHA-06": ["pills in the cabinet",   "something in the drawer",   "easy access tbh"],
    "SHA-07": ["wouldnt mind not waking","if i just disappeared",     "tired of existing"],
    "CRS-01": ["cant handle this",       "breaking down right now",   "losing it completely"],
    "CRS-02": ["just tonight",           "after tomorrow its over",   "gotta make it through"],
    "CRS-03": ["need help right now",    "cant wait anymore",         "its urgent now"],
    "CRS-04": ["know what ill use",      "already have it ready",     "planned it out"],
    "CRS-05": ["tell everyone i love",   "goodbye to my people",      "last message fr"],
    "CRS-06": ["actually feeling great", "everything resolved now",   "no more problems"],
    "CCM-01": ["fr fr cant do this",     "ngl been struggling",       "lowkey losing it"],
    "CCM-02": ["switching between worlds","code switching exhausting", "two different mes"],
    "CCM-03": ["its giving depression",  "no cap im done",            "slay but make it sad"],
    "CCM-04": ["its not that deep but",  "not a big deal but",        "probably nothing but"],
    "CCM-05": ["gotta stay strong tho",  "cant show weakness",        "keeping it together"],
    "CCM-06": ["somethings been off",    "hard to put into words",    "cant really explain"],
    "CCM-07": ["first in my family",     "parents dont understand",   "pressure to succeed"],
    "CCM-08": ["between two cultures",   "dont belong anywhere",      "neither world accepts"],
    "CCM-09": ["lowkey highkey struggling","ngl fr fr",               "on god its hard"],
    "CCM-10": ["state passed another bill","they hate people like me","not safe being me"],
    "CCM-11": ["political climate scary","laws targeting my community","scared of whats next"],
    "CCM-12": ["church says im wrong",   "faith vs who i am",         "god doesnt love me"],
}

RISK_TIERS   = ["low", "moderate", "high", "crisis"]
RISK_WEIGHTS = [0.60,  0.25,       0.12,   0.03]

RISK_SCORE_RANGES = {
    "low":      (0.05, 0.35),
    "moderate": (0.36, 0.65),
    "high":     (0.66, 0.89),
    "crisis":   (0.90, 0.99),
}

RISK_TRENDS        = ["stable", "increasing", "decreasing"]
RISK_TREND_WEIGHTS = [0.45, 0.35, 0.20]

CULTURAL_CONTEXTS = [
    "AAVE_CODE_SWITCH", "MINIMIZATION", "ISOLATION_PATTERN",
    "PERFORMATIVE_POSITIVITY", "FIRST_GEN_STRESSOR",
    "LGBTQ_STRESSOR", "IMMIGRATION_STRESSOR", "YOUTH_SLANG",
]

RECOMMENDED_ACTIONS = {
    "low":      "monitor",
    "moderate": "schedule_followup",
    "high":     "priority_followup",
    "crisis":   "immediate_crisis_protocol",
}

REVIEW_ACTIONS = [
    "contacted_member", "scheduled_session", "escalated_to_crisis",
    "no_action_required", "flagged_false_positive",
]

CLINICIAN_NOTES = [
    "Reached member by text; confirmed safe.",
    "Scheduled session for next available slot.",
    "Member did not respond; left voicemail.",
    "Reviewed with supervisor; escalated to crisis team.",
    "Context reviewed; determined low clinical concern.",
    "Member confirmed this was venting, not ideation.",
    "Follow-up call completed; safety plan reviewed.",
    "Coordinated with on-call crisis counselor.",
    "Member engaged well; coping strategies discussed.",
    "False positive - cultural expression misread by model.",
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"

def rand_ts(days_back: int = 90) -> datetime:
    offset = random.randint(0, days_back * 24 * 60)
    return datetime.now(timezone.utc) - timedelta(minutes=offset)

def fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S+00")

def esc(s: str) -> str:
    """Escape single quotes for SQL."""
    return s.replace("'", "''")

def pick_signals(tier: str) -> list[str]:
    if tier == "low":
        pool = [k for k in SIGNALS if k[:3] in ("CCM", "ISO", "HOP")]
        return random.sample(pool, k=random.randint(1, 2))
    elif tier == "moderate":
        pool = [k for k in SIGNALS if k[:3] in ("HOP", "ISO", "CCM")]
        return random.sample(pool, k=random.randint(2, 3))
    elif tier == "high":
        pool = [k for k in SIGNALS if k[:3] in ("HOP", "ISO", "SHA", "CCM")]
        return random.sample(pool, k=random.randint(2, 4))
    else:
        pool = [k for k in SIGNALS if k[:3] in ("CRS", "SHA", "HOP")]
        return random.sample(pool, k=random.randint(3, 4))

def sql_array(lst: list[str]) -> str:
    if not lst:
        return "NULL"
    return "ARRAY[" + ", ".join(f"'{v}'" for v in lst) + "]"

def nullable_str(v) -> str:
    return f"'{esc(str(v))}'" if v is not None else "NULL"

def nullable_int(v) -> str:
    return str(v) if v is not None else "NULL"

# ── Build data ─────────────────────────────────────────────────────────────────

def build_members():
    members = []
    # Assign sequential fake IDs starting at 1 — matches SERIAL order
    fake_id = 1
    for org in ORGS:
        for _ in range(10):
            members.append({
                "fake_id":      fake_id,
                "member_token": uid("mbr"),
                "org_id":       org,
            })
            fake_id += 1
    return members

def build_events(members):
    events = []
    source_types = ["peer-post", "journal", "chat", "assessment"]
    for source_type in source_types:
        for _ in range(250):
            member = random.choice(members)
            tier   = random.choices(RISK_TIERS, weights=RISK_WEIGHTS)[0]
            lo, hi = RISK_SCORE_RANGES[tier]
            score  = round(random.uniform(lo, hi), 3)
            trend  = random.choices(RISK_TRENDS, weights=RISK_TREND_WEIGHTS)[0]
            ts     = rand_ts(90)

            if tier == "crisis":
                deadline = ts + timedelta(minutes=10)
            elif tier == "high":
                deadline = ts + timedelta(hours=24)
            else:
                deadline = None

            reviewed = tier in ("high", "crisis") and random.random() < 0.40

            events.append({
                "event_id":           uid("ing"),
                "original_source_id": uid(source_type[:4]),
                "member_fake_id":     member["fake_id"],
                "member_token":       member["member_token"],
                "org_id":             member["org_id"],
                "source_type":        source_type,
                "event_timestamp":    ts,
                "risk_tier":          tier,
                "risk_score":         score,
                "risk_trend":         trend,
                "cultural_context":   random.sample(CULTURAL_CONTEXTS, k=random.randint(0, 3)),
                "recommended_action": RECOMMENDED_ACTIONS[tier],
                "clinician_reviewed": reviewed,
                "review_deadline":    deadline,
                "signals":            pick_signals(tier),
                "group_id":    random.choice(GROUPS)       if source_type == "peer-post"  else None,
                "mood_score":  random.randint(1, 5)        if source_type == "journal"    else None,
                "session_id":  uid("sess")                 if source_type == "chat"       else None,
                "role":        random.choice(["member","coach"]) if source_type == "chat" else None,
                "instrument":  random.choice(INSTRUMENTS)  if source_type == "assessment" else None,
                "item_number": random.randint(1, 8)        if source_type == "assessment" else None,
            })
    random.shuffle(events)
    return events

def build_reviews(events, members):
    token_to_fake_id = {m["member_token"]: m["fake_id"] for m in members}
    reviews = []
    for ev in events:
        if not ev["clinician_reviewed"]:
            continue
        org_id    = ev["org_id"]
        therapist = random.choice(THERAPISTS[org_id])
        reviewed_at = ev["event_timestamp"] + timedelta(hours=random.randint(1, 20))
        reviews.append({
            "review_id":      uid("rev"),
            "event_id":       ev["event_id"],
            "member_fake_id": ev["member_fake_id"],
            "therapist_id":   therapist,
            "action":         random.choice(REVIEW_ACTIONS),
            "notes":          random.choice(CLINICIAN_NOTES),
            "reviewed_at":    reviewed_at,
        })
    return reviews

# ── SQL generation ─────────────────────────────────────────────────────────────

def generate(members, events, reviews) -> str:
    L = []

    L.append("-- ============================================================")
    L.append("-- V9: Seed data — 50 members, 1000 events, signals, SHAP, reviews")
    L.append("-- Uses a temp ID map so no correlated subqueries are needed.")
    L.append("-- ============================================================")
    L.append("")
    L.append("BEGIN;")
    L.append("")

    # ── 1. Members ────────────────────────────────────────────────────────────
    L.append("-- 50 members across 5 orgs")
    L.append("INSERT INTO members (member_token, org_id) VALUES")
    L.append(",\n".join(
        f"  ('{m['member_token']}', '{m['org_id']}')"
        for m in members
    ) + ";")
    L.append("")

    # ── 2. Temp map: member_token → actual serial id ──────────────────────────
    L.append("-- Temp table to hold member_token → id mapping")
    L.append("CREATE TEMP TABLE _member_id_map AS")
    L.append("  SELECT id, member_token FROM members;")
    L.append("")

    # ── 3. Inference events ───────────────────────────────────────────────────
    L.append("-- 1000 inference events")
    L.append("INSERT INTO inference_events (")
    L.append("  event_id, original_source_id, member_id, org_id, source_type,")
    L.append("  event_timestamp, group_id, mood_score, session_id, role,")
    L.append("  instrument, item_number, risk_tier, risk_score, risk_trend,")
    L.append("  cultural_context, recommended_action, clinician_reviewed,")
    L.append("  review_deadline, model_version")
    L.append(")")
    L.append("SELECT")
    L.append("  v.event_id, v.original_source_id,")
    L.append("  m.id AS member_id,")
    L.append("  v.org_id, v.source_type, v.event_timestamp::timestamptz,")
    L.append("  v.group_id, v.mood_score::smallint, v.session_id, v.role,")
    L.append("  v.instrument, v.item_number::smallint,")
    L.append("  v.risk_tier, v.risk_score::numeric, v.risk_trend,")
    L.append("  v.cultural_context, v.recommended_action,")
    L.append("  v.clinician_reviewed::boolean,")
    L.append("  v.review_deadline::timestamptz, v.model_version")
    L.append("FROM (VALUES")

    event_rows = []
    for ev in events:
        dl = f"'{fmt(ev['review_deadline'])}'" if ev["review_deadline"] else "NULL"
        cc = sql_array(ev["cultural_context"])
        row = (
            f"  ('{ev['event_id']}', '{ev['original_source_id']}', "
            f"'{ev['member_token']}', '{ev['org_id']}', '{ev['source_type']}', "
            f"'{fmt(ev['event_timestamp'])}', "
            f"{nullable_str(ev['group_id'])}, "
            f"{nullable_int(ev['mood_score'])}, "
            f"{nullable_str(ev['session_id'])}, "
            f"{nullable_str(ev['role'])}, "
            f"{nullable_str(ev['instrument'])}, "
            f"{nullable_int(ev['item_number'])}, "
            f"'{ev['risk_tier']}', {ev['risk_score']}, '{ev['risk_trend']}', "
            f"{cc}, "
            f"'{ev['recommended_action']}', "
            f"{'TRUE' if ev['clinician_reviewed'] else 'FALSE'}, "
            f"{dl}, '1.0.0')"
        )
        event_rows.append(row)

    L.append(",\n".join(event_rows))
    L.append(") AS v(")
    L.append("  event_id, original_source_id, member_token, org_id, source_type,")
    L.append("  event_timestamp, group_id, mood_score, session_id, role,")
    L.append("  instrument, item_number, risk_tier, risk_score, risk_trend,")
    L.append("  cultural_context, recommended_action, clinician_reviewed,")
    L.append("  review_deadline, model_version")
    L.append(")")
    L.append("JOIN _member_id_map m ON m.member_token = v.member_token;")
    L.append("")

    # ── 4. Temp map: event_id → inference_events.id ───────────────────────────
    L.append("-- Temp table: event_id string → inference_events.id integer")
    L.append("CREATE TEMP TABLE _event_id_map AS")
    L.append("  SELECT id, event_id FROM inference_events;")
    L.append("")

    # ── 5. Event signals ──────────────────────────────────────────────────────
    L.append("-- Event signals")
    L.append("INSERT INTO event_signals (event_id, signal_code, signal_label, confidence, dimension)")
    L.append("SELECT e.id, v.signal_code, v.signal_label, v.confidence::numeric, v.dimension")
    L.append("FROM (VALUES")

    sig_rows = []
    for ev in events:
        for code in ev["signals"]:
            label, dimension = SIGNALS[code]
            conf = round(random.uniform(0.62, 0.97), 3)
            sig_rows.append(
                f"  ('{ev['event_id']}', '{code}', '{esc(label)}', {conf}, '{dimension}')"
            )

    L.append(",\n".join(sig_rows))
    L.append(") AS v(event_id, signal_code, signal_label, confidence, dimension)")
    L.append("JOIN _event_id_map e ON e.event_id = v.event_id;")
    L.append("")

    # ── 6. SHAP attributions ──────────────────────────────────────────────────
    L.append("-- SHAP attributions")
    L.append("INSERT INTO shap_attributions (event_id, span, weight, signal_code, rank)")
    L.append("SELECT e.id, v.span, v.weight::numeric, v.signal_code, v.rank::smallint")
    L.append("FROM (VALUES")

    shap_rows = []
    for ev in events:
        for rank, code in enumerate(ev["signals"][:3], start=1):
            spans = SHAP_SPANS.get(code, ["something concerning"])
            span  = random.choice(spans)
            weight = round(random.uniform(0.15, 0.55), 4)
            shap_rows.append(
                f"  ('{ev['event_id']}', '{esc(span)}', {weight}, '{code}', {rank})"
            )

    L.append(",\n".join(shap_rows))
    L.append(") AS v(event_id, span, weight, signal_code, rank)")
    L.append("JOIN _event_id_map e ON e.event_id = v.event_id;")
    L.append("")

    # ── 7. Review actions ─────────────────────────────────────────────────────
    if reviews:
        L.append("-- Review actions")
        L.append("INSERT INTO review_actions (review_id, event_id, member_id, therapist_id, action, clinician_notes, reviewed_at)")
        L.append("SELECT v.review_id, e.id, m.id, v.therapist_id, v.action, v.notes, v.reviewed_at::timestamptz")
        L.append("FROM (VALUES")

        rev_rows = []
        for rv in reviews:
            rev_rows.append(
                f"  ('{rv['review_id']}', '{rv['event_id']}', "
                f"'{members[rv['member_fake_id']-1]['member_token']}', "
                f"'{rv['therapist_id']}', '{rv['action']}', "
                f"'{esc(rv['notes'])}', '{fmt(rv['reviewed_at'])}')"
            )

        L.append(",\n".join(rev_rows))
        L.append(") AS v(review_id, event_id, member_token, therapist_id, action, notes, reviewed_at)")
        L.append("JOIN _event_id_map e ON e.event_id = v.event_id")
        L.append("JOIN _member_id_map m ON m.member_token = v.member_token;")
        L.append("")

    # ── 8. Build snapshots ────────────────────────────────────────────────────
    L.append("-- Build member_risk_snapshots for all members with events")
    L.append("DO $$")
    L.append("DECLARE r RECORD;")
    L.append("BEGIN")
    L.append("  FOR r IN SELECT DISTINCT member_id FROM inference_events LOOP")
    L.append("    PERFORM upsert_member_risk_snapshot(r.member_id);")
    L.append("  END LOOP;")
    L.append("END $$;")
    L.append("")

    # ── 9. Assign therapists ──────────────────────────────────────────────────
    L.append("-- Assign therapists to snapshots by org")
    for org, therapists in THERAPISTS.items():
        for i, thr in enumerate(therapists):
            L.append(f"UPDATE member_risk_snapshots s SET therapist_id = '{thr}'")
            L.append(f"  FROM members m WHERE s.member_id = m.id")
            L.append(f"  AND m.org_id = '{org}' AND (m.id % {len(therapists)}) = {i};")
    L.append("")

    # ── 10. Drop temp tables ──────────────────────────────────────────────────
    L.append("DROP TABLE _member_id_map;")
    L.append("DROP TABLE _event_id_map;")
    L.append("")
    L.append("COMMIT;")
    L.append("")
    L.append("-- Verify")
    L.append("SELECT 'members'              AS tbl, COUNT(*) AS rows FROM members")
    L.append("UNION ALL SELECT 'inference_events',   COUNT(*) FROM inference_events")
    L.append("UNION ALL SELECT 'event_signals',      COUNT(*) FROM event_signals")
    L.append("UNION ALL SELECT 'shap_attributions',  COUNT(*) FROM shap_attributions")
    L.append("UNION ALL SELECT 'review_actions',     COUNT(*) FROM review_actions")
    L.append("UNION ALL SELECT 'snapshots',          COUNT(*) FROM member_risk_snapshots;")

    return "\n".join(L)


if __name__ == "__main__":
    print("Generating seed data...")
    members = build_members()
    events  = build_events(members)
    reviews = build_reviews(events, members)

    print(f"  Members : {len(members)}")
    print(f"  Events  : {len(events)}")
    print(f"  Signals : {sum(len(e['signals']) for e in events)}")
    print(f"  SHAP    : {sum(min(len(e['signals']),3) for e in events)}")
    print(f"  Reviews : {len(reviews)}")

    sql = generate(members, events, reviews)

    out = Path(__file__).parent.parent / "migrations" / "V9__seed_1000_events.sql"
    out.write_text(sql, encoding="utf-8")
    print(f"\nWritten → {out}")
