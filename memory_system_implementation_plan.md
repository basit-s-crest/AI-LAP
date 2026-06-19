# Implementation Plan — Three-Layer Memory System for Live Therapy Sessions

## Purpose of this document

This is the build plan for the memory system that powers real-time clinical
question suggestions during live coaching/therapy sessions, and carries
context forward across a patient's entire treatment history.

It covers three memory layers, where each one lives, when each is written
and read, and exactly where semantic (vector) retrieval is used versus
plain relational queries. This is implementation-ready — each phase maps
to working code, not just concepts.

---

## 0. The problem this solves

A therapist meeting a returning patient needs three things simultaneously:

1. **What's happening right now** in this session (the last 30-60 seconds
   of speech) — needs immediate, low-latency context.
2. **What happened earlier in this same session** (10 minutes ago, the
   patient mentioned something — is it still relevant now?) — needs
   session-scoped continuity.
3. **What happened in past sessions** — weeks or months ago, a core fear
   was named, a breakthrough occurred, a risk signal appeared — needs
   long-term, semantically searchable recall.

A single buffer or a single table cannot serve all three needs well.
Each has different latency requirements, different retention windows,
and different retrieval patterns. That's why this is three layers, not one.

---

## 1. The three memory layers — overview

| Layer | Name | Scope | Storage | Retrieval method | Lifetime |
|---|---|---|---|---|---|
| L1 | Working buffer | Current session, last ~60s | In-memory (Python process) | Direct read, no search needed | Seconds to minutes |
| L2 | Session episodic memory | Current session, full duration | Postgres (Supabase) | Sequential read by timestamp | One session |
| L3 | Longitudinal memory | All past sessions for this patient | Postgres + pgvector (Supabase) | Semantic vector search + structured filters | Entire treatment history |

Each layer feeds the next. L1 is summarized into L2 every few minutes.
L2 is distilled into L3 after the session ends. L3 is retrieved back into
the live context window during future sessions — closing the loop.

```
   Live speech ──> L1 (buffer) ──> L2 (session episodes) ──> L3 (longitudinal)
                      │                    │                        │
                      │                    │                        │
                 used during          used during              used at the
                 THIS session's      THIS session for          START of and
                 RAG analysis        "what did they say        DURING every
                 every ~30s          10 min ago" recall        future session
```

---

## 2. Layer 1 — Working buffer (live, in-memory)

### What it is
A rolling window of the patient's raw transcribed speech, held entirely
in application memory for the duration of the live session. Not persisted
to any database — this is the fastest, shortest-lived layer.

### Why it doesn't need a database
At 30-60 second windows, the data volume is tiny and the access pattern
is single-process, single-session. Writing this to Postgres on every
Deepgram chunk would add latency for zero retrieval benefit — nothing
needs to *search* this layer, it just needs to *exist* until summarized.

### Data structure

```python
from collections import deque
import time

class WorkingBuffer:
    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self.chunks: deque[tuple[float, str]] = deque()

    def add(self, text: str, speaker_role: str):
        if speaker_role != "member":
            return  # coach speech never enters this buffer
        self.chunks.append((time.time(), text))
        self._evict_old()

    def _evict_old(self):
        cutoff = time.time() - self.window_seconds
        while self.chunks and self.chunks[0][0] < cutoff:
            self.chunks.popleft()

    def get_text(self) -> str:
        return " ".join(text for _, text in self.chunks)
```

### When it's read
Every 30 seconds, the live RAG analysis loop calls `get_text()` to pull
the current window for the active sentiment/question-suggestion call.

### When it's written
Every time Deepgram emits a `is_final=True` transcript chunk attributed
to the patient (not the coach).

---

## 3. Layer 2 — Session episodic memory (this session, persisted)

### What it is
A sequence of compressed 2-minute summaries generated throughout the
live session. This is the session's short-term memory — it lets the
system (and later, the patient's longitudinal record) know what happened
at minute 4, minute 12, minute 38 of *this specific session*, without
needing to re-read raw transcript text.

### Why this layer exists separately from L1 and L3
L1 is too short-lived to capture "what did the patient say 10 minutes
ago in this same session" — by then it's been evicted. L3 only gets
written *after* the session ends. L2 is the bridge: it accumulates
during the session and is immediately available for in-session recall,
then gets fed into L3's extraction process once the session closes.

### Why plain Postgres, not pgvector, for this layer
Within a single session, you don't need semantic search — you need
chronological recall. "What happened earlier in today's session" is
answered by `order by episode_index` with a simple time-range filter,
not by embedding similarity. Save the vector index for L3, where you're
searching across potentially hundreds of past episodes and need semantic
matching, not just time-ordering.

### Schema

```sql
create table public.session_live_episodes (
  id            text not null default gen_random_uuid()::text,
  session_id    text not null references public."Session"(id),
  member_id     text not null references public."User"(id),
  episode_index integer not null,        -- 0, 1, 2... in chronological order

  summary       text not null,            -- 3-4 sentence compressed summary
  sentiment     text not null,            -- CRISIS | HIGH | MEDIUM | LOW
  themes        text[] not null default '{}',

  created_at    timestamptz not null default now(),

  constraint session_live_episodes_pkey primary key (id)
);

create index session_live_episodes_session_idx
  on public.session_live_episodes (session_id, episode_index asc);
```

### When it's written
Every 2 minutes, a background task drains the current L1 buffer's
accumulated history (not just the last 60s — the full 2-minute span
since the last episode), summarizes it with a lightweight LLM call,
and inserts one row.

```python
async def summarize_and_store_episode(
    session_id: str,
    member_id: str,
    episode_index: int,
    raw_text: str,
):
    if len(raw_text.split()) < 20:
        return  # not enough speech to summarize meaningfully

    summary_response = await groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{
            "role": "user",
            "content": (
                "Compress this 2-minute therapy session transcript into "
                "3-4 sentences. Preserve emotional tone, key themes, "
                "unresolved statements, self-disclosure. Discard filler "
                "and repetition.\n\nTRANSCRIPT:\n" + raw_text
            )
        }],
        temperature=0.1,
        max_tokens=200,
    )
    summary = summary_response.choices[0].message.content.strip()

    sentiment, themes = await classify_episode(summary)

    await supabase.table("session_live_episodes").insert({
        "session_id": session_id,
        "member_id": member_id,
        "episode_index": episode_index,
        "summary": summary,
        "sentiment": sentiment,
        "themes": themes,
    }).execute()
```

### When it's read
Two consumers:
1. The live RAG loop, every 30s, pulls the last 3-5 episodes from this
   session (`order by episode_index desc limit 5`) to give the LLM
   in-session continuity beyond the 60-second L1 window.
2. The post-session extractor (Section 4) reads *all* episodes for the
   session once it ends, as the primary input for distilling L3 events.

---

## 4. Layer 3 — Longitudinal memory (across all sessions, pgvector)

This is where semantic retrieval earns its place. Everything in L1 and
L2 is plain relational data because the access pattern is sequential and
scoped to "right now" or "this session." L3 is different: you're asking
"has this patient said anything like this before, possibly months ago,
across dozens of sessions" — that is fundamentally a similarity search
problem, and pgvector is the right tool specifically for that question.

### 4a. Sub-layer: significant event store (the vector table)

#### What it is
One row per clinically significant moment, extracted from a completed
session's transcript. Each row has a narrative description and a vector
embedding of that narrative, enabling semantic search across the
patient's entire history.

#### Why semantic search matters here specifically
A keyword search for "abandonment" would miss a patient saying "I think
I push people away before they can leave me" — there's no shared keyword,
but the embedding captures the same underlying theme. This is the single
clearest case in the whole system where vector retrieval outperforms
any structured query you could write by hand.

#### Schema

```sql
create extension if not exists vector;

create table public.member_memory_events (
  id              text not null default gen_random_uuid()::text,
  member_id       text not null references public."User"(id),
  session_id      text not null references public."Session"(id),
  coach_id        text not null references public."Coach"(id),
  session_number  integer not null,
  session_date    date not null,

  category        text not null,
  -- BREAKTHROUGH | DISCLOSURE | TURNING_POINT |
  -- RESISTANCE | PROGRESS_MARKER | NAMED_FEAR | RISK_SIGNAL

  narrative       text not null,         -- embedded field, third-person case note
  raw_quote       text,                  -- exact patient words, optional

  emotional_valence text,                -- POSITIVE | NEGATIVE | AMBIVALENT
  significance_score float8 not null,    -- 0.0 to 1.0
  themes          text[] not null default '{}',

  embedding       vector(384),           -- bge-small-en-v1.5 output

  last_referenced timestamptz,
  created_at      timestamptz not null default now(),

  constraint member_memory_events_pkey primary key (id)
);

create index member_memory_events_embedding_idx
  on public.member_memory_events
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index member_memory_events_member_category_idx
  on public.member_memory_events (member_id, category, significance_score desc);
```

#### When it's written
Once per completed session, by a background job triggered when
`Session.status` transitions to `completed`.

```python
async def extract_significant_events(session_id: str, member_id: str):
    episodes = await supabase.table("session_live_episodes") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("episode_index") \
        .execute()

    full_session_summary = "\n".join(
        f"[{e['sentiment']}] {e['summary']}" for e in episodes.data
    )

    prior_count = await count_existing_events(member_id)

    extraction = await groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{"role": "user", "content": build_extraction_prompt(
            full_session_summary, prior_count
        )}],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=2000,
    )
    events = json.loads(extraction.choices[0].message.content)

    for event in events:
        if event["significance_score"] < 0.6:
            continue  # only persist meaningfully significant moments
        embedding = embedder.encode(event["narrative"]).tolist()
        await supabase.table("member_memory_events").insert({
            "member_id": member_id,
            "session_id": session_id,
            "category": event["category"],
            "narrative": event["narrative"],
            "raw_quote": event.get("raw_quote"),
            "emotional_valence": event["emotional_valence"],
            "significance_score": event["significance_score"],
            "themes": event["themes"],
            "embedding": embedding,
        }).execute()
```

#### When it's read — two distinct retrieval patterns

**Pattern A: Semantic recall during a live session (the core vector use case)**

Every 30 seconds during a live session, after building a clinical query
from the current speech window, search this table for similar past events.

```sql
create or replace function match_member_memory(
  p_member_id      text,
  query_embedding  vector(384),
  match_threshold  float default 0.38,
  match_count      int default 4
)
returns table (
  id text, category text, narrative text, session_date date,
  session_number int, significance_score float8, similarity float
)
language sql stable as $$
  select
    id, category, narrative, session_date, session_number,
    significance_score,
    1 - (embedding <=> query_embedding) as similarity
  from public.member_memory_events
  where
    member_id = p_member_id
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by
    (1 - (embedding <=> query_embedding)) * 0.65
    + significance_score * 0.35 desc
  limit match_count;
$$;
```

**Pattern B: Structured recall at session start (no vector search needed)**

When a session begins, before any speech has happened, load the
highest-significance and most recent events directly — this is a plain
filtered sort, not a similarity search, because there's no query text
to embed yet.

```python
async def load_session_brief(member_id: str) -> dict:
    top_events = await supabase.table("member_memory_events") \
        .select("category, narrative, session_date, significance_score") \
        .eq("member_id", member_id) \
        .order("significance_score", desc=True) \
        .limit(5).execute()

    risk_events = await supabase.table("member_memory_events") \
        .select("narrative, session_date") \
        .eq("member_id", member_id) \
        .eq("category", "RISK_SIGNAL") \
        .order("session_date", desc=True) \
        .limit(3).execute()

    return {"top_events": top_events.data, "risk_events": risk_events.data}
```

This distinction matters: vector search is for "find things related to
what's being said right now." Structured filtering is for "load known
important facts regardless of what's being said." Don't force the second
case through an embedding search — it's slower and adds no value when
you already know exactly which rows you want by category and recency.

### 4b. Sub-layer: longitudinal profile (structured rollup, no vector)

#### What it is
One row per patient, holding a synthesized view of their entire treatment
history — recurring themes, core wounds, progress trajectory, risk flags.
Updated after every session.

#### Why this is plain Postgres, not pgvector
This table answers questions like "what is this patient's current risk
tier" or "what are their top 3 recurring themes" — these are aggregate
facts computed from L3a, not similarity queries. There's nothing to
semantically search; it's a denormalized cache of conclusions already
drawn from the vector layer.

#### Schema

```sql
create table public.member_longitudinal_profile (
  id                      text not null default gen_random_uuid()::text,
  member_id               text not null unique references public."User"(id),
  coach_id                text not null references public.Coach(id),

  baseline_phq_score      integer,
  baseline_gad_score      integer,
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
```

#### When it's written
Immediately after the event extraction step (4a) completes for a
session — this is step 2 of the same post-session job.

#### When it's read
At the very start of every session, alongside the session brief from
4a Pattern B. This is the first thing loaded into the live RAG context,
before any speech has occurred.

---

## 5. How the layers compose during a live session — the full call sequence

```
SESSION START
  │
  ├─> Load L3 longitudinal profile (plain query)
  ├─> Load L3 top significant events (plain query, Pattern B)
  └─> Initialize empty L1 buffer, L2 episode counter = 0

EVERY DEEPGRAM FINAL CHUNK (patient speech only)
  └─> Append to L1 buffer

EVERY 30 SECONDS (live RAG analysis loop)
  ├─> Read L1 buffer (last 60s of raw speech)
  ├─> Read L2 (last 3-5 episodes from this session)
  ├─> Build clinical query from L1 text (one Groq call)
  ├─> Vector search L3a with that query (Pattern A — semantic)
  ├─> Assemble prompt: L3 profile + L3a results + L2 episodes + L1 text
  ├─> Main Groq call -> sentiment + suggested questions
  └─> Push result to coach dashboard via WebSocket

EVERY 2 MINUTES (episodic summarizer)
  ├─> Drain L1 buffer's accumulated 2-min span
  ├─> Summarize with Groq (lightweight call)
  └─> Write one row to L2 (session_live_episodes)

SESSION ENDS (Session.status -> completed)
  ├─> Read all L2 episodes for this session
  ├─> Extract significant events (Groq call) -> write to L3a
  └─> Recompute and update L3b longitudinal profile
```

---

## 6. Build phases — what to implement, in order

### Phase 1 — L1 working buffer + Deepgram integration
- Implement `WorkingBuffer` class
- Wire Deepgram WebSocket handler to call `buffer.add()` on final chunks
- Filter coach speech out at ingestion (never enters the buffer)
- Validate: buffer correctly evicts chunks older than the window

**Done when**: you can print the last 60 seconds of patient speech at
any point during a live test session.

### Phase 2 — L2 episodic summarizer
- Create `session_live_episodes` table in Supabase
- Implement the 2-minute summarizer background task
- Implement the episode classifier (sentiment + themes) call
- Wire it to run as an `asyncio` task per active session

**Done when**: a 20-minute test session produces ~10 rows in
`session_live_episodes`, each a coherent 3-4 sentence summary.

### Phase 3 — L3a significant event extraction (pgvector)
- Enable `vector` extension in Supabase
- Create `member_memory_events` table with the embedding column and
  ivfflat index
- Implement the post-session extraction job, triggered on session
  completion
- Set up the embedding model (`bge-small-en-v1.5` via sentence-transformers)
- Implement the `match_member_memory` RPC function

**Done when**: after a completed test session, querying
`member_memory_events` for that patient returns rows with populated
embeddings, and a semantic search for a related phrase (not the exact
words used) returns a relevant result above the 0.38 threshold.

### Phase 4 — L3b longitudinal profile
- Create `member_longitudinal_profile` table
- Implement the profile update job (runs immediately after Phase 3's
  extraction, same post-session pipeline)
- Implement `overall_progress_score` computation logic

**Done when**: after 2-3 simulated sessions for the same test patient,
the profile's `recurring_themes` and `progress_markers` reflect content
from across those sessions, and the progress score moves in a sensible
direction given the simulated content.

### Phase 5 — Wire it all into the live RAG loop
- Implement `load_session_brief()` (Pattern B reads from L3)
- Implement the clinical query builder
- Implement the full prompt assembler combining L1 + L2 + L3a + L3b
- Connect the 30-second analysis loop to call the Strands RAG agent
  with this assembled context
- Stream results to the coach dashboard via WebSocket

**Done when**: starting a new live session for a returning test patient
immediately surfaces their past core wounds and risk flags in the coach
UI, and as the test session progresses, semantically related past
events from Phase 3 appear in the suggested-question rationale.

### Phase 6 — Compliance hardening (can run in parallel with Phase 2-5)
- Add RLS policies to all three new tables
- Add the audit trigger to `member_memory_events` and
  `session_live_episodes`
- Add encryption to the `narrative` and `raw_quote` columns if your
  compliance review requires field-level encryption beyond Supabase's
  encryption-at-rest

**Done when**: a coach account querying another coach's patient data
is blocked by RLS, and every insert into `member_memory_events`
produces a corresponding row in `phi_access_log`.

---

## 7. Where vector search is used vs not — quick reference

| Question being answered | Layer | Method |
|---|---|---|
| What did the patient just say (last 60s)? | L1 | In-memory read |
| What happened earlier in today's session? | L2 | Chronological SQL query |
| What is this patient's known risk tier? | L3b | Plain SQL lookup |
| What are this patient's top recurring themes? | L3b | Plain SQL lookup |
| Has this patient said anything like this before? | L3a | **Vector similarity search** |
| What past moments relate to what's being said right now? | L3a | **Vector similarity search** |
| Load the 5 most significant moments ever recorded | L3a | Plain SQL sort (no query text exists yet) |

The rule of thumb: if you have a piece of *current text* to compare
against history, use vector search. If you're filtering by a *known
attribute* (category, date, score) with no text to compare, use plain SQL.
Most of this system is the second case — only the live in-session
recall against L3a is genuinely a semantic search problem, and that's
exactly where pgvector is applied.

---

## 8. Open decisions before implementation starts

- Confirm BAA coverage extends to Groq and Deepgram, not just Supabase,
  since both process PHI in transit.
- Decide the significance threshold for L3a writes (this plan uses 0.6
  — events below this are summarized but not persisted long-term).
- Decide ivfflat `lists` parameter tuning once you have a realistic
  estimate of total events per patient (start at 50, revisit after
  the first cohort of real sessions).
- Decide retention period for `session_live_episodes` after a session
  ends — this plan assumes they're kept indefinitely for audit, but
  your compliance team may want a shorter window since L3a already
  captures the clinically significant content.
