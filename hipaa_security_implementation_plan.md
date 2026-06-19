# Implementation Plan — HIPAA Technical Safeguards

## Important scope note before anything else

This document is an implementation plan for the **technical safeguards**
under the HIPAA Security Rule (45 CFR §164.312) as they apply to this
system's database, API, and infrastructure. It is not legal advice and
it does not by itself make the product "HIPAA compliant."

Full HIPAA compliance requires, in addition to everything below:
administrative safeguards (workforce training, a designated Privacy
Officer, sanctions policy), physical safeguards (if any infrastructure
is on-prem), a formal risk assessment performed by a qualified party,
a documented incident response and breach notification plan, and signed
Business Associate Agreements with every vendor that touches PHI —
Supabase, Groq, and Deepgram at minimum, since transcripts and derived
clinical content pass through all three.

This plan assumes the BAAs are being handled separately (per our
earlier discussion, this is already in progress) and focuses entirely
on what the engineering team needs to build.

---

## 0. What counts as PHI in this system

Before building safeguards, it's worth being explicit about what data
is actually PHI, since that determines which tables and which API
payloads need protection. In this system, PHI includes:

- Session transcripts (raw and any derived summaries)
- `AiSessionNote` contents — summary, keyThemes, coachObservations,
  riskNotes, memberSentiment
- `SessionNote` contents — coach's clinical notes
- `OnboardingAssessment` — PHQ-9/GAD-7 answers and scores
- `Mood` entries
- `member_memory_events` — narrative and raw_quote fields
- `member_longitudinal_profile` — core_wounds, progress_markers,
  risk_flags, unresolved_threads
- Any audio passed to Deepgram, and any text passed to Groq, for the
  duration it's in transit and in their processing pipeline

Things that are NOT PHI and don't need the same handling: aggregate
non-identifying metrics, the `CommunityGroup` / `PeerGroupPost` tables
(peer community content, not clinical record, though still treat
respectfully), and system operational logs that don't reference a
specific patient.

---

## 1. The four pillars this plan implements

```
┌─────────────────────────────────────────────────────────┐
│  1. ACCESS CONTROL                                       │
│     Row Level Security + role-based policies +           │
│     minimum-necessary enforcement                         │
├─────────────────────────────────────────────────────────┤
│  2. AUDIT CONTROLS                                        │
│     Database-level triggers logging every PHI             │
│     read/write — not optional application code            │
├─────────────────────────────────────────────────────────┤
│  3. INTEGRITY                                              │
│     Append-only audit logs, soft-delete only on            │
│     clinical records, no silent overwrites                │
├─────────────────────────────────────────────────────────┤
│  4. TRANSMISSION SECURITY + ENCRYPTION                     │
│     TLS everywhere in transit, encryption at rest,         │
│     field-level encryption on the most sensitive columns   │
└─────────────────────────────────────────────────────────┘
```

Each pillar maps to a specific phase below.

---

## 2. Phase 1 — Access control (Row Level Security)

### Goal
A coach can only ever query data for patients explicitly assigned to
them via `CoachMember`. A patient can only ever query their own data.
This must be enforced at the database layer, not just in application
code — RLS means even a bug in your FastAPI authorization logic cannot
leak another patient's data, because Postgres itself blocks the row.

### Implementation

```sql
-- Enable RLS on every table containing PHI
alter table public."AiSessionNote" enable row level security;
alter table public."SessionNote" enable row level security;
alter table public."OnboardingAssessment" enable row level security;
alter table public."Mood" enable row level security;
alter table public.member_memory_events enable row level security;
alter table public.member_longitudinal_profile enable row level security;
alter table public.session_live_episodes enable row level security;

-- Coaches see only assigned patients' session notes
create policy coach_reads_assigned_session_notes
  on public."AiSessionNote"
  for select
  using (
    exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = "AiSessionNote"."memberId"
      and cm."coachId" = (select auth.uid()::text)
    )
  );

-- Patients see only their own session notes
create policy member_reads_own_session_notes
  on public."AiSessionNote"
  for select
  using ("memberId" = (select auth.uid()::text));

-- Same pattern applied to SessionNote
create policy coach_reads_assigned_session_notes_2
  on public."SessionNote"
  for select
  using (
    exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = "SessionNote"."memberId"
      and cm."coachId" = (select auth.uid()::text)
    )
  );

-- Same pattern applied to member_memory_events
create policy coach_reads_assigned_memory_events
  on public.member_memory_events
  for select
  using (
    exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = member_memory_events.member_id
      and cm."coachId" = (select auth.uid()::text)
    )
  );

-- Same pattern applied to member_longitudinal_profile
create policy coach_reads_assigned_profile
  on public.member_longitudinal_profile
  for select
  using (
    exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = member_longitudinal_profile.member_id
      and cm."coachId" = (select auth.uid()::text)
    )
  );

-- Admins get broader read access — still gated by role check, still audited
create policy admin_reads_all_session_notes
  on public."AiSessionNote"
  for select
  using (
    exists (
      select 1 from public."User" u
      where u.id = (select auth.uid()::text)
      and u.role = 'admin'
    )
  );

-- No one can hard-delete clinical records via the API — covered in Phase 3
create policy no_hard_delete_session_notes
  on public."AiSessionNote"
  for delete
  using (false);

create policy no_hard_delete_memory_events
  on public.member_memory_events
  for delete
  using (false);
```

### FastAPI side — minimum necessary enforcement

RLS handles the database boundary. The API layer should still actively
scope queries rather than relying on RLS as the only check — defense
in depth.

```python
# dependencies/auth.py

async def get_current_coach(token: str = Depends(oauth2_scheme)) -> Coach:
    coach = await verify_and_decode_coach_token(token)
    if not coach:
        raise HTTPException(status_code=401)
    return coach

async def require_assigned_patient(
    member_id: str,
    coach: Coach = Depends(get_current_coach),
    db: AsyncSession = Depends(get_db),
):
    """
    Dependency that BOTH application code and RLS enforce.
    If this check passes but RLS would have blocked it, that's a bug
    to catch in testing — they should always agree.
    """
    assignment = await db.execute(
        select(CoachMember).where(
            CoachMember.coachId == coach.id,
            CoachMember.userId == member_id,
        )
    )
    if not assignment.scalar_one_or_none():
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this patient's records",
        )
```

### Done when
A test coach account, when queried against another coach's patient,
receives a 403 from the API and an empty result set from a raw SQL
query against the database directly (proving RLS, not just app logic,
is the actual enforcement boundary).

---

## 3. Phase 2 — Audit controls

### Goal
Every read, create, update, or delete of PHI is logged automatically,
at the database level, with enough detail to answer "who accessed this
patient's data, when, and why" during a compliance audit or breach
investigation.

### Why database triggers instead of application logging
Application-level audit logging (a line of code in your FastAPI handler
that writes to a log table) is fragile — a new endpoint, a bug, or a
direct database script can bypass it silently. A trigger fires on the
write itself, so it is structurally impossible to write to a PHI table
without an audit row being created.

### Schema

```sql
create table public.phi_access_log (
  id              bigint generated always as identity primary key,
  actor_id        text not null,
  actor_role      text not null,        -- 'member' | 'coach' | 'admin' | 'system'
  action          text not null,        -- 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'EXPORT'
  resource_table  text not null,
  resource_id     text not null,
  patient_id      text,
  access_reason   text,
  ip_address      inet,
  user_agent      text,
  accessed_at     timestamptz not null default now()
);

-- This table itself is immutable once written
revoke update, delete on public.phi_access_log from public;

create index phi_access_log_patient_idx
  on public.phi_access_log (patient_id, accessed_at desc);
create index phi_access_log_actor_idx
  on public.phi_access_log (actor_id, accessed_at desc);
```

### Trigger function

```sql
create or replace function log_phi_access()
returns trigger as $$
begin
  insert into public.phi_access_log (
    actor_id, actor_role, action, resource_table, resource_id,
    patient_id, accessed_at
  ) values (
    coalesce(current_setting('app.current_user_id', true), 'system'),
    coalesce(current_setting('app.current_user_role', true), 'unknown'),
    case
      when TG_OP = 'INSERT' then 'CREATE'
      when TG_OP = 'UPDATE' then 'UPDATE'
      when TG_OP = 'DELETE' then 'DELETE'
    end,
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    coalesce(NEW."memberId", OLD."memberId", NEW.member_id, OLD.member_id),
    now()
  );
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger audit_ai_session_note
  after insert or update or delete on public."AiSessionNote"
  for each row execute function log_phi_access();

create trigger audit_session_note
  after insert or update or delete on public."SessionNote"
  for each row execute function log_phi_access();

create trigger audit_member_memory_events
  after insert or update or delete on public.member_memory_events
  for each row execute function log_phi_access();

create trigger audit_longitudinal_profile
  after insert or update or delete on public.member_longitudinal_profile
  for each row execute function log_phi_access();
```

### Capturing READ access (the part triggers can't do)

Triggers only fire on writes. SELECT statements don't trigger anything
in Postgres by default, but HIPAA audit requirements typically expect
read access to be logged too — especially for sensitive records like
session transcripts. Handle this explicitly in the API layer for read
endpoints specifically, since it can't be done at the trigger level.

```python
# In your FastAPI route handler, after a successful PHI read
async def log_read_access(
    db: AsyncSession,
    actor_id: str,
    actor_role: str,
    resource_table: str,
    resource_id: str,
    patient_id: str,
    request: Request,
):
    await db.execute(
        insert(phi_access_log).values(
            actor_id=actor_id,
            actor_role=actor_role,
            action="READ",
            resource_table=resource_table,
            resource_id=resource_id,
            patient_id=patient_id,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
```

### Setting session context for the trigger

```python
# middleware/db_context.py

async def set_db_session_context(
    db: AsyncSession, user_id: str, role: str
):
    """
    Called at the start of every authenticated request. The trigger
    function reads these session variables to know who's acting.
    """
    await db.execute(
        text("SELECT set_config('app.current_user_id', :uid, false)"),
        {"uid": user_id},
    )
    await db.execute(
        text("SELECT set_config('app.current_user_role', :role, false)"),
        {"role": role},
    )

# Wire this into a dependency that runs before any PHI-touching route
async def get_db_with_context(
    coach: Coach = Depends(get_current_coach),
    db: AsyncSession = Depends(get_db),
):
    await set_db_session_context(db, coach.id, "coach")
    yield db
```

### Done when
Every insert, update, and delete against `AiSessionNote`,
`SessionNote`, `member_memory_events`, and `member_longitudinal_profile`
produces exactly one corresponding row in `phi_access_log`, and that
row correctly identifies the actor even when the write originates from
a background job (set `app.current_user_role` to `'system'` for those).

---

## 4. Phase 3 — Integrity (no silent loss of clinical data)

### Goal
Clinical records are never hard-deleted. If something needs to be
removed (a correction, a patient's right-to-amend request), the system
preserves the original and records the change — never overwrites
history silently.

### Soft delete pattern

```sql
alter table public."AiSessionNote" add column "deletedAt" timestamp without time zone;
alter table public."SessionNote" add column "deletedAt" timestamp without time zone;
alter table public.member_memory_events add column deleted_at timestamptz;

-- RLS policies should exclude soft-deleted rows from normal reads
create policy coach_reads_active_session_notes
  on public."AiSessionNote"
  for select
  using (
    "deletedAt" is null
    and exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = "AiSessionNote"."memberId"
      and cm."coachId" = (select auth.uid()::text)
    )
  );
```

```python
# Application layer — never issue a DELETE on clinical tables
async def soft_delete_session_note(db: AsyncSession, note_id: str, actor_id: str):
    await db.execute(
        update(SessionNote)
        .where(SessionNote.id == note_id)
        .values(deletedAt=datetime.utcnow())
    )
    await db.commit()
    # The audit trigger logs this as an UPDATE automatically
```

### Correction pattern (instead of editing in place)

For clinical notes specifically, prefer an append-only correction model
over in-place edits, since HIPAA's amendment process (45 CFR §164.526)
expects the original record to remain visible alongside any amendment.

```sql
create table public.session_note_amendments (
  id              text not null default gen_random_uuid()::text,
  original_note_id text not null references public."SessionNote"(id),
  amended_by      text not null,
  amendment_text  text not null,
  reason          text,
  created_at      timestamptz not null default now(),

  constraint session_note_amendments_pkey primary key (id)
);
```

### Done when
Attempting a hard delete on any clinical table from the API returns a
403 (blocked by the RLS `for delete using (false)` policy from Phase 1),
and a soft-deleted record still appears in `phi_access_log` with full
history intact.

---

## 5. Phase 4 — Encryption (transmission + at rest + field-level)

### 5a. Transmission security (in transit)

This is mostly configuration, not schema:

- All API traffic over TLS 1.2+ only — enforce this at your load
  balancer / reverse proxy, reject plaintext HTTP entirely.
- Supabase connections use SSL by default — verify `sslmode=require`
  is set in your connection string, don't rely on the default.
- Deepgram and Groq API calls already use HTTPS — confirm your BAA
  with each vendor covers data in transit through their infrastructure,
  not just at-rest storage on their end.
- WebSocket connections (your live coach dashboard) must use `wss://`,
  never `ws://`, in any environment handling real session data.

```python
# main.py — reject any non-TLS connection at the app level as a backstop
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if settings.ENVIRONMENT == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
```

### 5b. Encryption at rest

Supabase encrypts the entire database at rest by default (AES-256) —
this covers the baseline requirement with no extra work. The additional
field-level encryption below is for the most sensitive columns
specifically, per the earlier decision to layer both.

### 5c. Field-level encryption on the most sensitive columns

```sql
create extension if not exists pgsodium;

-- Add encrypted shadow columns to the highest-sensitivity fields
alter table public."AiSessionNote"
  add column transcript_encrypted bytea,
  add column summary_encrypted bytea,
  add column "coachObservations_encrypted" bytea,
  add column "riskNotes_encrypted" bytea;

alter table public."SessionNote"
  add column notes_encrypted bytea;

alter table public.member_memory_events
  add column narrative_encrypted bytea,
  add column raw_quote_encrypted bytea;
```

Encryption and decryption happen in the application layer using
Supabase Vault-managed keys, not by exposing raw keys to application
code:

```python
# services/encryption.py

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def encrypt_field(plaintext: str, key_id: str) -> bytes:
    """
    Calls Supabase's pgsodium-backed encryption function via RPC.
    The actual encryption key never leaves the database — the app
    only ever sends plaintext in and gets ciphertext back, or vice versa.
    """
    result = await supabase.rpc("encrypt_phi_field", {
        "plaintext": plaintext,
        "key_id": key_id,
    }).execute()
    return result.data

async def decrypt_field(ciphertext: bytes, key_id: str) -> str:
    result = await supabase.rpc("decrypt_phi_field", {
        "ciphertext": ciphertext,
        "key_id": key_id,
    }).execute()
    return result.data
```

```sql
-- Supabase-side encrypt/decrypt RPC wrappers around pgsodium
create or replace function encrypt_phi_field(plaintext text, key_id uuid)
returns bytea
language plpgsql security definer as $$
begin
  return pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to(key_id::text, 'utf8'),
    key_id
  );
end;
$$;

create or replace function decrypt_phi_field(ciphertext bytea, key_id uuid)
returns text
language plpgsql security definer as $$
begin
  return convert_from(
    pgsodium.crypto_aead_det_decrypt(
      ciphertext,
      convert_to(key_id::text, 'utf8'),
      key_id
    ),
    'utf8'
  );
end;
$$;
```

### Migration approach — don't swap in place

```
Step 1: Add the _encrypted shadow columns (done above)
Step 2: New writes populate BOTH plaintext and encrypted columns
Step 3: Backfill script encrypts all existing plaintext rows
Step 4: Verify decryption round-trips correctly for a sample of rows
Step 5: Switch application reads to use the encrypted columns
Step 6: Only after a verified soak period, drop the plaintext columns
```

Never do steps 5 and 6 in the same deploy as step 1-4. A reversible
path matters more than speed here.

### Done when
Querying `AiSessionNote` directly via the Supabase SQL editor (bypassing
your application) shows ciphertext, not readable text, in the encrypted
columns, and a round-trip encrypt-then-decrypt test passes for sample
data of each sensitive field type.

---

## 6. Phase 5 — Consent gating (prerequisite to any PHI processing)

### Goal
No session can be recorded, transcribed, or sent to Groq/Deepgram for
analysis unless valid, current consent is on record. This is enforced
before the pipeline starts, not checked after the fact.

### Schema

```sql
create table public.patient_consent (
  id              text not null default gen_random_uuid()::text,
  patient_id      text not null references public."User"(id),
  consent_type    text not null,
  -- 'treatment' | 'recording' | 'ai_analysis' | 'data_sharing'
  consent_version text not null,
  granted         boolean not null,
  granted_at      timestamptz,
  revoked_at      timestamptz,
  ip_address      inet,
  document_url    text,
  created_at      timestamptz not null default now(),

  constraint patient_consent_pkey primary key (id)
);

create index patient_consent_active_idx
  on public.patient_consent (patient_id, consent_type, revoked_at)
  where revoked_at is null;
```

### Enforcement middleware

```python
# middleware/consent_gate.py

class ConsentRequiredError(Exception):
    pass

async def require_active_consent(
    db: AsyncSession,
    patient_id: str,
    consent_types: list[str],
):
    for consent_type in consent_types:
        result = await db.execute(
            select(PatientConsent).where(
                PatientConsent.patient_id == patient_id,
                PatientConsent.consent_type == consent_type,
                PatientConsent.granted == True,
                PatientConsent.revoked_at.is_(None),
            )
        )
        if not result.scalar_one_or_none():
            raise ConsentRequiredError(
                f"Missing active consent: {consent_type}"
            )

# Called BEFORE the Deepgram connection is even opened
async def start_live_session(session_id: str, patient_id: str, db: AsyncSession):
    await require_active_consent(
        db, patient_id, ["recording", "ai_analysis"]
    )
    # only after this passes does the Deepgram WebSocket get opened
    ...
```

### Done when
Attempting to start a live session for a patient with no `ai_analysis`
consent on record raises a blocking error before any audio reaches
Deepgram, verified by a test that confirms zero outbound calls were
made to either Deepgram or Groq in that scenario.

---

## 7. Phase 6 — Retention and disposal

### Goal
PHI is kept for a defined, documented period and not indefinitely by
default. Most US states require mental health records be retained for
a minimum period (commonly 7 years for adults, longer for minors —
confirm exact figures with your compliance/legal team per
jurisdiction), but "indefinite by accident" is itself a compliance risk.

### Schema

```sql
create table public.retention_policy (
  id                      text not null default gen_random_uuid()::text,
  resource_table          text not null unique,
  retention_period_days   integer not null,
  auto_delete_enabled     boolean not null default false,
  created_at              timestamptz not null default now(),

  constraint retention_policy_pkey primary key (id)
);

insert into public.retention_policy
  (resource_table, retention_period_days, auto_delete_enabled)
values
  ('AiSessionNote', 2555, false),
  ('SessionNote', 2555, false),
  ('member_memory_events', 2555, false),
  ('session_live_episodes', 2555, false),
  ('phi_access_log', 2555, false);
```

`auto_delete_enabled` defaults to false intentionally — automatic
deletion of clinical records is a decision that should require explicit
sign-off from compliance/legal, not a default behavior shipped by
engineering. When/if enabled, pair it with a manual review queue rather
than an unattended cron job that deletes records outright.

### Done when
A documented retention period exists for every PHI-containing table,
reviewed and approved by whoever owns compliance at your organization,
before any auto-deletion logic is turned on.

---

## 8. Build phases — summary checklist

| Phase | What | Depends on |
|---|---|---|
| 1 | RLS policies on all PHI tables + API-layer scoping | None — start here |
| 2 | Audit trigger + phi_access_log + read-access logging | Phase 1 tables must exist |
| 3 | Soft-delete pattern + amendment table | Phase 1 RLS delete-block policies |
| 4 | TLS enforcement + pgsodium field encryption + migration | Can run in parallel with 1-3 |
| 5 | Consent table + enforcement middleware | None — can start immediately |
| 6 | Retention policy table + documented periods | Requires compliance sign-off, not just engineering |

Phases 1, 2, 4, and 5 should all be in place **before** any real patient
data enters the system. Phase 3 should be in place before the first
correction/deletion request is ever needed. Phase 6 requires a decision
from outside engineering before any automation is switched on.

---

## 9. What this plan does not cover

These remain outside the database/API implementation and need separate
ownership:

- Workforce HIPAA training and signed acknowledgment per employee
- A designated Privacy Officer and Security Officer (can be the same
  person at small scale, but must be named)
- A formal, documented risk assessment performed by someone qualified
  to conduct one — this plan is an engineering implementation, not a
  substitute for that assessment
- Incident response and breach notification procedures, including the
  required timelines for notifying affected patients and HHS
- Physical safeguards, if any infrastructure is self-hosted rather than
  fully on Supabase's managed infrastructure
- Confirming BAAs are fully executed (not just "in progress") with
  Supabase, Groq, and Deepgram before processing real PHI through any
  of them

A qualified healthcare compliance consultant should review this plan
and the resulting implementation before real patient data is processed
in production.
