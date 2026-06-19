# Implementation Plan: Three-Layer Memory System & HIPAA Safeguards

## Goal Description
Build a real-time, three-layer clinical memory system (L1 Working Buffer, L2 Session Episodes, L3 Longitudinal Memory) to power clinical question suggestions during live therapy sessions. Concurrently, implement required HIPAA Technical Safeguards (Access Control, Audit Controls, Integrity, Transmission Security, and Consent Gating) to secure all Protected Health Information (PHI) processed by the system.

---

## User Review Required

> [!IMPORTANT]
> - **L2 Encryption Decision**: As per the recent decision, the `summary` column in `session_live_episodes` will **not** be encrypted. This preserves readability/performance for sequential SQL queries.
> - **Baseline RLS**: We are establishing the baseline Row Level Security (RLS) policies from scratch, as there are currently no existing RLS policies on the database.
> - **BAA Status Check**: Ensure that Business Associate Agreements (BAAs) with Supabase, Groq, and Deepgram are fully signed before real PHI enters the system.
> - **Retention Policy Approval**: A compliance officer must approve the exact retention period (defaulted to 7 years / 2555 days) before automated deletion is turned on.

---

## Database Schema & DDL Specifications

We will apply the following database objects to the Supabase database. These tables represent the storage layers and the compliance controls:

```sql
-- Enable required extensions
create extension if not exists vector;
create extension if not exists pgsodium;

-- ==========================================
-- PHASE 1: CONSENT & AUDIT SCHEMA
-- ==========================================

create table public.patient_consent (
  id              text not null default gen_random_uuid()::text,
  patient_id      text not null references public."User"(id),
  consent_type    text not null, -- 'recording' | 'ai_analysis'
  consent_version text not null,
  granted         boolean not null default false,
  granted_at      timestamptz default now(),
  revoked_at      timestamptz,
  ip_address      inet,
  document_url    text,
  created_at      timestamptz not null default now(),
  constraint patient_consent_pkey primary key (id)
);
create index patient_consent_active_idx
  on public.patient_consent (patient_id, consent_type, revoked_at)
  where revoked_at is null;

create table public.phi_access_log (
  id              bigint generated always as identity primary key,
  actor_id        text not null,
  actor_role      text not null,        -- 'member' | 'coach' | 'admin' | 'system'
  action          text not null,        -- 'CREATE' | 'UPDATE' | 'DELETE' | 'READ'
  resource_table  text not null,
  resource_id     text not null,
  patient_id      text,
  ip_address      inet,
  user_agent      text,
  accessed_at     timestamptz not null default now()
);
revoke update, delete on public.phi_access_log from public;
create index phi_access_log_patient_idx on public.phi_access_log (patient_id, accessed_at desc);
create index phi_access_log_actor_idx on public.phi_access_log (actor_id, accessed_at desc);

-- ==========================================
-- PHASE 3: L2 SESSION LIVE EPISODES
-- ==========================================

create table public.session_live_episodes (
  id            text not null default gen_random_uuid()::text,
  session_id    text not null references public."Session"(id),
  member_id     text not null references public."User"(id),
  episode_index integer not null,        -- Chronological: 0, 1, 2...
  summary       text not null,            -- Compressed summary (unencrypted per decision)
  sentiment     text not null,            -- CRISIS | HIGH | MEDIUM | LOW
  themes        text[] not null default '{}',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint session_live_episodes_pkey primary key (id)
);
create index session_live_episodes_session_idx
  on public.session_live_episodes (session_id, episode_index asc);

-- ==========================================
-- PHASE 4: L3a MEMBER MEMORY EVENTS
-- ==========================================

create table public.member_memory_events (
  id                  text not null default gen_random_uuid()::text,
  member_id           text not null references public."User"(id),
  session_id          text not null references public."Session"(id),
  coach_id            text not null references public."Coach"(id),
  session_number      integer not null,
  session_date        date not null,
  category            text not null, -- BREAKTHROUGH | DISCLOSURE | TURNING_POINT | RISK_SIGNAL
  narrative_encrypted bytea not null,
  raw_quote_encrypted bytea,
  emotional_valence   text,          -- POSITIVE | NEGATIVE | AMBIVALENT
  significance_score  float8 not null,
  themes              text[] not null default '{}',
  embedding           vector(384) not null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint member_memory_events_pkey primary key (id)
);
create index member_memory_events_embedding_idx
  on public.member_memory_events using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- ==========================================
-- PHASE 5: L3b LONGITUDINAL PROFILE
-- ==========================================

create table public.member_longitudinal_profile (
  id                      text not null default gen_random_uuid()::text,
  member_id               text not null unique references public."User"(id),
  coach_id                text not null references public."Coach"(id),
  presenting_conditions   text[] not null default '{}',
  core_wounds             text[] not null default '{}',
  recurring_themes        text[] not null default '{}',
  progress_markers        text[] not null default '{}',
  risk_flags              text[] not null default '{}',
  unresolved_threads      text[] not null default '{}',
  overall_progress_score  float8 not null default 50.0,
  current_risk_tier       text not null default 'low',
  risk_trend              text,
  total_sessions          integer not null default 0,
  last_session_date       date,
  last_updated            timestamptz not null default now(),
  constraint member_longitudinal_profile_pkey primary key (id)
);

-- ==========================================
-- PHASE 7: RETENTION POLICY
-- ==========================================

create table public.retention_policy (
  id                      text not null default gen_random_uuid()::text,
  resource_table          text not null unique,
  retention_period_days   integer not null,
  auto_delete_enabled     boolean not null default false,
  created_at              timestamptz not null default now(),
  constraint retention_policy_pkey primary key (id)
);
insert into public.retention_policy (resource_table, retention_period_days) values
  ('AiSessionNote', 2555), ('SessionNote', 2555), ('member_memory_events', 2555),
  ('session_live_episodes', 2555), ('phi_access_log', 2555);
```

### Encryption & Decryption Helper Functions (pgsodium)
```sql
create or replace function encrypt_phi_field(plaintext text, key_id uuid)
returns bytea language plpgsql security definer as $$
begin
  return pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to(key_id::text, 'utf8'),
    key_id
  );
end;
$$;

create or replace function decrypt_phi_field(ciphertext bytea, key_id uuid)
returns text language plpgsql security definer as $$
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

---

## Row Level Security (RLS) Policies

We will activate RLS on all tables and create policies enforcing the rule: **Coaches read assigned patients' data; Members read only their own data; No API hard deletes.**

```sql
alter table public.patient_consent enable row level security;
alter table public.session_live_episodes enable row level security;
alter table public.member_memory_events enable row level security;
alter table public.member_longitudinal_profile enable row level security;
alter table public."AiSessionNote" enable row level security;
alter table public."SessionNote" enable row level security;
alter table public."OnboardingAssessment" enable row level security;
alter table public."Mood" enable row level security;

-- Example: member_memory_events
create policy coach_reads_assigned_memory_events on public.member_memory_events
  for select using (
    exists (
      select 1 from public."CoachMember" cm
      where cm."userId" = member_memory_events.member_id
      and cm."coachId" = (select auth.uid()::text)
    )
  );

create policy member_reads_own_memory_events on public.member_memory_events
  for select using (member_id = (select auth.uid()::text));

create policy no_hard_delete_memory_events on public.member_memory_events
  for delete using (false);

-- Apply similar policies to patient_consent, session_live_episodes, member_longitudinal_profile,
-- AiSessionNote, SessionNote, OnboardingAssessment, and Mood.
```

---

## Audit Triggers DDL
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

create trigger audit_session_live_episodes
  after insert or update or delete on public.session_live_episodes
  for each row execute function log_phi_access();

create trigger audit_member_memory_events
  after insert or update or delete on public.member_memory_events
  for each row execute function log_phi_access();

create trigger audit_longitudinal_profile
  after insert or update or delete on public.member_longitudinal_profile
  for each row execute function log_phi_access();

-- Also apply to "AiSessionNote" and "SessionNote"
```

---

## Detailed Phase-by-Phase Execution Plans

### Phase 1: Security Foundation, Consent Gating & Encryption Setup
* **Objective**: Deploy HIPAA baseline configurations to allow secure data operations. All subsequent features rely on these gates.
* **Steps**:
  1. **SQL Migration**: Write a new database migration file `V14__hipaa_consent_and_audit.sql` in `backend/vasl-db/migrations/` declaring `patient_consent`, `phi_access_log`, pgsodium RPC functions, and enabling RLS. Apply it:
     ```powershell
     cd backend
     python -m app.migrate
     ```
  2. **Prisma Schema Update**: Update `frontend/BE/prisma/schema.prisma` with the models matching new tables. Sync database client:
     ```powershell
     cd frontend/BE
     npx prisma@5 generate
     ```
  3. **Consent Middleware ([consent_gate.py](file:///c:/Projects-Crest/AI-LAP/backend/app/middleware/consent_gate.py))**:
     Implement database queries verifying that active consent with `granted=true` and `revoked_at is null` exists for the given patient:
     ```python
     from sqlalchemy.future import select
     from app.core.database import AsyncSession
     # query public.patient_consent
     ```
  4. **Encryption Utility ([encryption.py](file:///c:/Projects-Crest/AI-LAP/backend/app/shared/encryption.py))**:
     Implement functions using the async DB connection to invoke pgsodium crypto RPCs:
     ```python
     async def encrypt_phi_field(db: AsyncSession, plaintext: str) -> bytes:
         # call select encrypt_phi_field(:text, :key_id)
     ```

---

### Phase 2: L1 Working Buffer & STT Consent Check
* **Objective**: Setup the short-term rolling in-memory buffer for raw member speech and enforce consent verification at the WebSocket entry point.
* **Steps**:
  1. **L1 Working Buffer ([live_analysis.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/live_analysis/live_analysis.py))**:
     Implement a thread-safe `WorkingBuffer` with a 60-second eviction rule:
     ```python
     from collections import deque
     import time

     class WorkingBuffer:
         def __init__(self, window_seconds: int = 60):
             self.window_seconds = window_seconds
             self.chunks = deque() # holds tuple (timestamp, text)

         def add(self, text: str):
             self.chunks.append((time.time(), text))
             self._evict()

         def _evict(self):
             cutoff = time.time() - self.window_seconds
             while self.chunks and self.chunks[0][0] < cutoff:
                 self.chunks.popleft()

         def get_text(self) -> str:
             return " ".join(t[1] for t in self.chunks)
     ```
  2. **WebSocket Integration ([router.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/stt/router.py))**:
     - Check `sessionId` query parameter. Load `Session` record from database to find the corresponding `memberId`.
     - Call `require_active_consent(db, member_id, ['recording', 'ai_analysis'])`.
     - Reject unauthorized connections immediately with code `1008` before establishing Deepgram socket connection.
     - On successful connection, direct `is_final=True` member utterances to `WorkingBuffer.add()`.

---

### Phase 3: L2 Session Episodic Memory & Background Summarizer
* **Objective**: Compile raw transcript data into 2-minute chronological text episodes saved to database.
* **Steps**:
  1. **Episodic DDL**: Run `V15__session_live_episodes.sql` to define the table, set up RLS policies, and deploy `phi_access_log` write triggers. Sync Prisma models.
  2. **2-Minute Background Task ([memory_tasks.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/live_analysis/memory_tasks.py))**:
     Maintain a background timer task per active transcription session.
     ```python
     async def summarize_episode_loop(session_id: str, member_id: str):
         while session_active:
             await asyncio.sleep(120)
             raw_text = working_buffer.get_text() # drains 120s buffer
             # call Groq Llama/Gemini to get a 3-4 sentence clinical summary, sentiment, and themes
             # insert summary, sentiment, themes into session_live_episodes
     ```

---

### Phase 4: L3a Longitudinal Vector Memory (Significant Events)
* **Objective**: Generate and store vector embeddings of clinically significant highlights post-session, using field-level encryption.
* **Steps**:
  1. **Vector DDL**: Run migration `V16__member_memory_events.sql` declaring `public.member_memory_events`, vector columns, RLS limits, and trigger.
  2. **Extraction Engine ([memory_tasks.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/live_analysis/memory_tasks.py))**:
     Add an event-driven hook triggered when a LiveKit session ends (status changes to `completed`):
     - Retrieve all L2 episodes from the session.
     - Execute an LLM query requesting extraction of clinical breakthroughs, resistance points, named fears, and crisis signals.
     - For each extracted event, generate text embedding using a local `bge-small-en-v1.5` pipeline.
     - Call `encrypt_phi_field` on narrative and quote fields.
     - Insert records into `member_memory_events`.

---

### Phase 5: L3b Longitudinal Profile & Rollup
* **Objective**: Aggregate recurring themes, progress trajectories, and risk trends into a structured profile on session wrap-up.
* **Steps**:
  1. **Profile DDL**: Run `V17__member_longitudinal_profile.sql` for the database schema, RLS, and triggers.
  2. **Compilation Engine ([memory_tasks.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/live_analysis/memory_tasks.py))**:
     Immediately following the significant event extraction task:
     - Load all memory events for the patient.
     - Decrypt narrative texts.
     - Pass historical events to the LLM to summarize presenting concerns, core wounds, recurring themes, progress markers, and current risk tier.
     - Perform a DB upsert on `member_longitudinal_profile`.

---

### Phase 6: Live RAG loop & Read Audit Logging
* **Objective**: Match real-time speech semantically against L3 history, build compiled clinical context prompts, and log all select reads.
* **Steps**:
  1. **RAG Orchestrator ([live_analysis.py](file:///c:/Projects-Crest/AI-LAP/backend/app/modules/live_analysis/live_analysis.py))**:
     Update `_run_analysis` (running every 30s):
     - Take rolling L1 buffer text and use Groq to compile a clinical context matching query.
     - Vectorize query text to 384-dimensions.
     - Perform cosine vector similarity matching against `member_memory_events` where `member_id = patient_id` and similarity is above `0.38`.
     - Decrypt matching events.
     - Read the L3b profile and recent L2 summaries.
     - Assemble full prompt and query Groq for suggested therapist questions.
  2. **Select Read Logger**:
     - Inside the query execution code, write an access row to `phi_access_log` identifying the coach, action `READ`, and patient ID.

---

### Phase 7: Retention Policy & TLS Compliance
* **Objective**: Configure automated retention metadata and enforce secure socket / protocol configuration.
* **Steps**:
  1. **Retention DDL**: Run `V18__retention_policy.sql` defining retention periods. Sync with Prisma.
  2. **TLS enforcement ([main.py](file:///c:/Projects-Crest/AI-LAP/backend/main.py))**:
     Deploy HTTPS redirection middleware for non-local environments:
     ```python
     if os.getenv("ENVIRONMENT") == "production":
         app.add_middleware(HTTPSRedirectMiddleware)
     ```
     Ensure all WebSocket connections on Next.js/Express connect using `wss://`.

---

## Verification Plan

### Automated Tests
1. **Consent Gating**: Connect a test WebSocket client to `/v1/stt` with a valid JWT but without active consent in the database. Verify that the server rejects with code `1008` (Policy Violation) and zero requests are made to Deepgram.
2. **Access Control (RLS)**: Connect to the DB using a test coach session token. Verify that a select on `member_memory_events` returns an empty array for members not assigned to that coach.
3. **Audit Log Validation**: Perform an insert/update on `member_memory_events` and verify that a new row in `phi_access_log` is created with the matching table, action, and ID.
4. **Field Encryption**: Insert a mock significant event, then query the database via raw SQL to confirm `narrative_encrypted` contains binary data, not plaintext. Decrypt via RPC and verify round-trip equivalence.
5. **Memory Retrieval Tests**: Run semantic vector matching via `match_member_memory` RPC. Confirm similarity threshold matching is functional for similar query strings (e.g. searching "afraid" matches "scared").

### Manual Verification
1. Run local dev environments using `./dev.ps1`.
2. Start a session as a coach and member, ensuring active consents exist.
3. Conduct a 5-minute mock transcription session, saying specific key clinical phrases (e.g., "I've been feeling extremely stressed about my exams").
4. Verify that:
   - Live analysis suggestions appear on the coach dashboard every 30s.
   - Summaries are written to `session_live_episodes` every 2 minutes.
   - On ending the session, events are successfully written to `member_memory_events` and the profile is updated.
   - `phi_access_log` registers both the writes and the reads.
