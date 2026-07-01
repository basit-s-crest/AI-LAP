# PROJECT DOCUMENTATION: SafeCircle (VASL-ALAP)
*Comprehensive System Architecture and Technical Specifications*

---

## 1. Project Overview

### Project Name
**SafeCircle** (Internally referenced as **VASL** / **VASL-ALAP**)

### Purpose of the System
SafeCircle is a HIPAA-compliant, real-time clinical decision support platform and early distress detection system. It is designed to assist mental health coaches, therapists, and clinical directors by active observation of patient communication channels. By capturing, analyzing, and synthesizing multimodal signals (textual sentiment, vocal acoustics, facial emotion, and structured clinical questionnaires), SafeCircle provides actionable insights and risk mitigation protocols before patient distress deteriorates into a crisis.

### Business Problem Solved
Traditional mental health monitoring relies on intermittent, subjective patient self-disclosures (e.g., weekly or monthly therapy sessions and occasional assessments). This approach fails to detect sudden emotional deterioration or hidden distress. Additionally, patients often engage in "wellness masking"—verbally claiming to feel well while displaying markers of extreme distress vocally or facially. SafeCircle solves these problems through:
1. **Continuous Real-Time Monitoring**: Observing active coaching sessions to identify live risks.
2. **Multimodal Affect Incongruence Detection**: Cross-analyzing acoustic and facial features against text sentiment to detect masking.
3. **Automated Documentation Rollups**: Reducing clinician administrative load by distilling raw session transcripts into structured summaries (L2), vector-embedded memory events (L3a), and longitudinal profiles (L3b).

### Target Users
* **Members (Patients)**: Individuals receiving mental health support, who track their daily mood and complete periodic assessments.
* **Coaches (Therapists/Clinicians)**: Professionals conducting coaching sessions, monitoring client risk, and receiving real-time clinical suggestions.
* **Clinical Directors / Admins**: Stakeholders managing organizational compliance, review deadlines, and crisis escalation protocols.

### Key Objectives
* **Pre-Crisis Detection**: Spot subtle markers (coded slang, withdrawal language, and acoustic agitation) using a dedicated, clinically aligned taxonomy.
* **Clinician In-Session Assistance**: Deliver live prompt suggestions and risk classifications directly to the therapist's screen.
* **Row-Level Security & HIPAA Compliance**: Ensure all Protected Health Information (PHI) is encrypted at rest using pg_crypto/pgsodium database functions, and audited on every read/write.
* **Low Latency Pipeline**: Maintain sub-second processing times for real-time speech-to-text, acoustic feature extraction, and dashboard notifications.

### Core Features
* **Ingestion Pipeline**: REST APIs accepting inputs from community peer posts, journal entries, chat logs, and clinical assessments (PHQ-8, GAD-7, ACEs) with automatic LLM-based risk classification.
* **Speech-to-Text (STT) Proxy**: Secure WebSocket gateway streaming user audio to Deepgram Nova-3 with sub-100ms silence endpointing.
* **Real-time Tone Analyzer**: Acoustic feature extraction (pitch, energy, pause ratio, speech rate) using `librosa` and `pydub`, calculating *affect congruence* between text and voice.
* **Live Meeting Analysis Engine**: RAG-augmented clinical agent powered by Strands and LiteLLM that injects patient history, past episodes, and acoustic snapshots to generate live coach suggestions.
* **Longitudinal Memory Rollup (L1 ➔ L2 ➔ L3)**: Layered memory architecture compressing short-term transcript chunks into permanent longitudinal profiles.

---

## 2. System Architecture

SafeCircle uses a decoupled service-oriented architecture. The system separates the customer-facing dashboard, the real-time websocket proxy, the heavy clinical reasoning engine, and the databases.

### High-Level Architecture Diagram
```
=================================================================================
                            SYSTEM ARCHITECTURE
=================================================================================

+-------------------------------------------------------------------------------+
|                            FRONTEND CLIENT SPACE                              |
|                                                                               |
|  [ Next.js Frontend (Port 3000) ] <====== WebRTC ======> [ LiveKit SFU Room ] |
|                │                                                ^             |
|                ├─(Dynamic Import)─➔ [ @mediapipe/tasks-vision ] │             |
|                │                         (Lazy loaded CDN WASM) │             |
|                └──────────────(Local/Remote Tracks Sampling)────┘             |
+------------------------+-------------------------------+----------------------+
                         |                               |
              (HTTP/REST / NextAuth)                     | (WebSockets:
                         |                                |  Audio & Emotions)
                         v                                v
+----------------------------------------+   +----------------------------------+
|      TypeScript Express Backend        |   |      Python FastAPI Backend      |
|   (Port 4000 - LiveKit Token Signer)   |   |           (Port 8000)            |
+------------------------+---------------+   +---------+--------+--------+------+
                         |                             |        |        |
             (Prisma Client / SSL)                     |        |        |
                         v                             |        |        |
+----------------------------------------+             |        |        |
|     Supabase Cloud PostgreSQL DB       |             |        |        |
|        (vasl_ts Schema Layer)          |             |        |        |
+----------------------------------------+             |        |        |
                                                       |        |        |
       (SQLAlchemy Async Session / SSL) ---------------┘        |        |
             v                                                  |        |
+----------------------------------------+                      |        |
|     Supabase Cloud PostgreSQL DB       |                      |        |
|     (vasl Schema - pgvector + Vault)   |                      |        |
|     [pgsodium / pgcrypto encryption]   |                      |        |
+----------------------------------------+                      |        |
                                                                |        |
             (Acoustic Analysis Stream) ------------------------┘        |
             v                                                           |
+----------------------------------------+                               |
|        Deepgram ASR WebSocket          |                               |
+----------------------------------------+                               |
                                                                         |
             (RAG Agent Orchestration) ----------------------------------┘
             v
+-------------------------------------------------------------------------------+
|                        AI/LLM INFERENCE PROVIDERS                             |
|                                                                               |
|   - Groq API (Llama 3.1 8B/70B)                                               |
|   - OpenRouter / Gemini API (Gemini 2.0 / 2.5)                                |
+-------------------------------------------------------------------------------+

---------------------------------------------------------------------------------
                           BACKGROUND PROCESSING SYSTEM
---------------------------------------------------------------------------------

                                 +-----------------------+
                                 |  Next.js App Server   |
                                 +-----------+-----------+
                                             | (Enqueue Jobs)
                                             v
+------------------+             +-----------+-----------+
|   BullMQ Worker  | <---------> |      Redis Database   |
| (Bg Processor)   |             | (Queue & PubSub :6379)|
+--------+---------+             +-----------+-----------+
         |                                   ^
         | (Trigger Ingest)                  | (SSE Stream)
         v                                   |
+------------------+                         |
|   FastAPI App    | ------------------------┘
+------------------+
```

### Data Flow Diagram
The processing workflow of a user's conversational message (e.g., peer post or chat) undergoes a multi-stage, audited pipeline:

```
=================================================================================
                                DATA FLOW PIPELINE
=================================================================================

 [ Member Client ]
        │
        │ 1. Submits message/post
        ▼
 [ Next.js Frontend Dashboard ]
        │
        │ 2. Request LiveKit room credentials & transcription JWT
        ▼
 [ TypeScript Express Backend ] (Port 4000)
        │
        ├─► Consent Gate check (verifies patient recording & analysis consent)
        │
        ├─► signs short-lived transcription JWT and requests token from LiveKit SFU
        ▼
 [ Redis Queue / BullMQ ] (Enqueues job asynchronously; immediately returns 202)
        │
        │ 4. Background Worker retrieves and processes queue job
        ▼
 [ Python FastAPI Backend ] (Port 8000)
        │
        ├─► [ PII Scrubbing ] (Scrubs identifiers from conversation text)
        │
        ├─► [ LLM Risk Classifier ] (Sends request to Groq or OpenRouter LLM)
        │
        ├─► [ DB Persistence ] (Stores result asynchronously in Supabase DB 'vasl')
        │        │
        │        └─► [ Encryption Engine ] (Invokes pgsodium for RLS & PHI encryption)
        │
        └─► [ Redis Pub/Sub ] (Publishes risk score update event)
                 │
                 ▼
 [ Next.js Server SSE Stream ] (Streams live score event via Server-Sent Events)
                 │
                 ▼
 [ Coach Live Monitor Dashboard ] (Updates UI elements, SHAP graphs, and alerts)
```

---

## 3. Technology Stack

| Layer | Technology | Purpose | Why Chosen |
| ----- | ---------- | ------- | ---------- |
| **Frontend Framework** | Next.js 16 (React 19) | Application Dashboard & UI rendering | Provides optimized Server-Side Rendering (SSR) via App Router, API routes, and Client-side hydration. |
| **Styling** | Vanilla CSS / Tailwind CSS | UI layouts, responsive utility styling, and glassmorphic designs | Offers absolute layout control, sleek aesthetics, and lightweight assets. |
| **TypeScript Backend** | Node.js Express | Auth, messaging, groups, and membership routing | High I/O handling, simple integration with Prisma and messaging websockets. |
| **Python Backend** | FastAPI (uvicorn) | LLM inference execution, acoustic/vocal features processing, and vector search | Best performance for async tasks, native Python library integration (`librosa`, `numpy`, `textblob`). |
| **State Management** | Redux Toolkit & React Query | Global dashboard client states & DB server sync | RTK handles localized authentication and UI states, while React Query optimizes database cache synchronization. |
| **Real-Time Video/Audio** | LiveKit Room SFU, SDK, & LiveKit Client | Live video/audio conferencing | Power high-fidelity WebRTC call routing between Coach and Member with low signaling overhead. |
| **Real-Time Speech** | Deepgram Nova-3 API & Deepgram SDK | Live streaming automatic speech recognition | Low latency streaming ASR with sub-100ms silence endpointing options. |
| **Facial & Gesture Ext.** | Google MediaPipe Tasks-Vision | Live face mesh landmark extraction | Runs in the client browser to capture 478 face landmarks and compute emotion indicators without sending raw video backends. |
| **Facial Emotion Recognition** | HSEmotion (EfficientNet-B2) & PyTorch / timm | Backend facial emotion inference | Classifies facial emotion from base64 frames concurrently using a dedicated FastAPI background thread pool. |
| **Acoustic processing** | Librosa, Pydub, & soundfile | Vocal pitch (F0 via PyIN), energy, and voice texture analysis | Standard scientific Python libraries for high-fidelity audio waveform analysis. |
| **De-identification & NLP** | MS Presidio & TextBlob / SpaCy | PII scrubbing and text sentiment analysis | Microsoft Presidio anonymizes PHI data before ingestion, and TextBlob computes polarity scores. |
| **Database (Auth/Core)** | Supabase PostgreSQL (`vasl_ts`) | User records, messages, groups, and coach logs | Managed cloud transactional engine, queried through Prisma ORM. |
| **Database (AI/Risk)** | Supabase PostgreSQL (`vasl` with pgvector) | Inference events, snapshots, memory events, and vectors | Enables semantic vector searches over clinical narratives using 384-dimensional pgvector embeddings. |
| **Background Processing**| Redis (`ioredis` / `redis`) & BullMQ | Asynchronous job queues and SSE message broadcasts | Guarantees decoupling of user-facing endpoints from heavy LLM calls. |
| **Orchestration** | Strands Framework & LiteLLM | Clinical RAG Agent & Note Comparison orchestration | Lightweight cognitive agent architecture wrapping LLM states. |
| **Encryption/Security** | Supabase Vault / pgsodium | HIPAA-compliant encryption of Protected Health Information (PHI) | Provides hardware/database level encryption with row-level policies. |
| **Visualizations & Alerts** | Recharts, Lucide React, & Sonner | Dashboard graphs, indicators, and alerts | Offers high-fidelity visual representations of clinical data (such as risk trends and SHAP parameters). |

---

## 4. Frontend Architecture

### Folder Structure
The Next.js client is structured within `frontend/FE`:
```
frontend/FE/
├── src/
│   ├── app/                    # Next.js App Router (layout, profile, dashboard, onboarding)
│   ├── components/             # Reusable UI widgets and session elements
│   │   ├── session/            # MeetingModal, VideoCanvas, EmotionFeed
│   │   ├── layout/             # Sidebar, Header, Page wrapper
│   │   └── ui/                 # Buttons, Cards, Badges
│   ├── hooks/                  # Custom React Hooks
│   │   ├── settings/           # useMemberSettings (consent, profile changes)
│   │   └── useLiveVideoAnalysis.ts # Face sampling, canvas drawing, websocket streaming
│   ├── services/               # API clients (settings, onboarding, chat)
│   ├── store/                  # Redux slices (authSlice)
│   └── lib/                    # Shared utility files (cn, vasl typings)
├── worker.mjs                  # BullMQ background job processor
└── package.json
```

### Frontend Technologies
* **LiveKit Room Integration (`@livekit/components-react`)**: Serves as the real-time calling core. The application leverages `<LiveKitRoom>` wrappers within [SessionVideoCall.tsx](file:///d:/AI-LAP/frontend/FE/src/components/livekit/SessionVideoCall.tsx) to manage remote/local tracks, camera/microphone muting states, and session lifecycles dynamically.
* **Google MediaPipe Tasks-Vision**: Lazy loaded dynamically in [facePresenceAnalyzer.ts](file:///d:/AI-LAP/frontend/FE/src/utils/facePresenceAnalyzer.ts) via CDN dynamic imports of `@mediapipe/tasks-vision` WASM compiler. This imports the heavy Google ASR and Vision modules only when video sampling is active, keeping initial JS bundle sizes light.
* **React Query**: Handles background synchronization of data (e.g., retrieving member consent states or assessment results). It invalidates cache segments automatically upon mutation.
* **WebRTC Media Streams**: Captures audio and video tracks from the user's input devices, routing raw PCM audio to the STT proxy and feeding video frames into the MediaPipe landmarker.

### UI Flow

#### 1. Onboarding & Assessment Flow
New members register ➔ Complete baseline GAD-7/PHQ-8 questionnaires ➔ The application computes baseline scores ➔ Stores profile details.
```
[User Registration] ➔ [Consent Modal (Explicit Opt-In)] ➔ [Baseline Assessments] ➔ [Dashboard Hydration]
```

#### 2. Live Session (Coach View)
1. Coach launches a Session ➔ System prompts for video/audio device permissions.
2. The user is prompted to consent to audio recording/AI clinical analysis.
3. Media tracks start: Audio is streamed to `/v1/stt`; video frames are processed on the frontend.
4. Alerts and live summaries populate the dashboard in real-time.

```
       Member Camera ➔ Canvas Processing ➔ Emotion API ──┐
                                                           ├─➔ WebSockets ➔ Live Monitor
       Member Mic ➔ Opus Encapsulation ➔ Deepgram ASR ────┘
```

---

## 5. Backend Architecture

### Folder Structure
The backend codebase is divided into two parts: Express (TypeScript) and FastAPI (Python).

#### Python Backend Architecture (`backend/app`)
```
backend/app/
├── api/                        # Global route entrypoints
├── core/                       # Database engine and session configuration
├── middleware/                 # Consent gate check validation
├── modules/                    # Domain-driven features
│   ├── live_analysis/          # LiveMeetingAnalysisEngine, L2 Summarizer loop, Tone Analyzer
│   ├── live_video_analysis/    # Session buffers and emotion aggregator
│   ├── risk_engine/            # Composite risk aggregator, decay formulas, risk snapshots
│   ├── rag/                    # Strands agents, embedders, vector retrievers
│   └── session_analysis/       # API routers (ingest, dashboard, pipeline)
└── shared/                     # Encryption wrappers, PII scrubbers, stage loggers
```

#### Express Backend Architecture (`frontend/BE`)
```
frontend/BE/
├── prisma/                     # Database schemas and deployments
└── src/
    ├── controllers/            # Auth, messaging, groups, and consent controllers
    ├── middleware/             # Express JWT token verification, audit logger
    ├── routes/                 # Express REST endpoint maps
    └── server.ts               # Core server configuration
```

### API Design
```
Ingestion Service (FastAPI :8001 / :8000)
├── POST /v1/ingest/peer-post     - Processes community posts for risk signals
├── POST /v1/ingest/journal       - Extracts sentiment & mood triggers from logs
├── POST /v1/ingest/chat          - Ingests active text conversations
└── POST /v1/ingest/assessment    - Evaluates question-level clinical distress

STT, Video, & Real-Time Gateway (FastAPI :8001 / :8000)
├── WS /v1/stt                    - Live STT streaming connection (requires JWT)
├── POST /api/emotion/detect      - Classifies facial emotion from base64 frames via HSEmotion
├── GET /v1/live-video-analysis/{session_id}/aggregation - Retrieves session-wide emotion counts/dominant metrics
└── POST /v1/change-detection/compare - Compares two session notes for progress and safety flags

Core User & Change Service (Express :5000 / :4000)
├── POST /api/auth/register       - Generates user accounts
├── POST /api/auth/consent        - Updates active consent flags for recording/analysis
├── GET /api/auth/consent         - Retrieves patient-specific consent statuses
├── GET /api/change-insights      - Retrieves historical change insights for a member
└── POST /api/change-insights/compare - Triggers AI session comparison
```

### Request Lifecycle (Ingestion API)
```
[Client POST /v1/ingest/chat]
       │
       ▼
[ConsentGate Middleware] ──(Inactive)──➔ [HTTP 403 Forbidden]
       │ (Active)
       ▼
[PII Scrubbing Module]
       │
       ▼
[LLM Ingestion Call] ──➔ (OpenRouter / Groq Call)
       │
       ▼
[HTTP 202 Accepted] (Returned to client with timing data)
       │
       ▼
[BackgroundTask: save_inference_result] ──➔ (Writes to DB: Event, Signals, SHAP)
       │
       ▼
[BackgroundTask: bust_member_cache] ──➔ (Clears Redis caches)
```

---

## 6. Database Design

### Database Technology
SafeCircle uses **Supabase Cloud** as its hosted PostgreSQL engine. The databases are partitioned logically into:
* **TypeScript Schema Layer (`vasl_ts`)**: Handled via **Prisma ORM**, structuring Core User Accounts, Message Channels, Organization Assignments, and Scheduling Logs.
* **Python/Clinical Schema Layer (`vasl`)**: Managed through custom SQL migrations, running under a thread-isolated SQLAlchemy connector. This layer contains the Vector Search models (`pgvector` at 384 dimensions) for semantic lookup of narrative episodes, audit logs, and risk aggregation tables.
* **Supabase Vault & pgsodium**: Leverages pgsodium cryptographic functions (`encrypt_phi_field` and `decrypt_phi_field`) wrapped in SQL RPC procedures. Keys are managed securely through Supabase Vault config variables (bound to the server `JWT_SECRET`), ensuring clinical transcripts and quotes (PHI) are encrypted natively at the database level.
* **Row-Level Security (RLS)**: Policies restrict data access based on authenticated user IDs (e.g., `member_reads_own_consent` and `coach_reads_assigned_consent`), matching HIPAA requirements for access controls.

### Database Schema (ER Diagram)
```
=================================================================================
                           DATABASE ENTITY-RELATIONSHIP MAP
=================================================================================

+------------------------+               +------------------------+
|          User          |               |     PatientConsent     |
+------------------------+               +------------------------+
| id (PK)           TEXT | <-----------o | id (PK)           TEXT |
| email             TEXT |               | patient_id (FK)   TEXT |
| password          TEXT |               | consent_type      TEXT |
| role              TEXT |               | granted        BOOLEAN |
| notifyDailyCheckin BOOL|               | revoked_at TIMESTAMPTZ |
+------------------------+               +------------------------+
    |                |
    |                |                   +------------------------+
    |                |                   |  OnboardingAssessment  |
    |                |                   +------------------------+
    |                └-----------------o | id (PK)           TEXT |
    |                                    | user_id (FK)      TEXT |
    |                                    | phqScore           INT |
    |                                    | gadScore           INT |
    |                                    +------------------------+
    |
    |------------------------+
    |                        |
    |                        |           +------------------------+
    |                        |           |        Session         |
    |                        |           +------------------------+
    |                        |           | id (PK)           TEXT |
    |                        |           | coachId           TEXT |
    |                        |           | memberId          TEXT |
    |                        |           | status            TEXT |
    |                        +-----------+------------+-----------+
    |                                                 |
    |                                                 | (one-to-many)
    |                                                 v
    |                                     +-----------+-----------+
    |                                     |   SessionLiveEpisode  |
    |                                     +-----------------------+
    |                                     | id (PK)          TEXT |
    |                                     | session_id (FK)  TEXT |
    |                                     | member_id (FK)   TEXT |
    |                                     | summary          TEXT |
    |                                     | sentiment        TEXT |
    |                                     | themes        TEXT[]  |
    |                                     +-----------------------+
    |
    |------------------------+
    |                        |
    |                        |           +------------------------+
    |                        |           |   MemberMemoryEvent    |
    |                        |           +------------------------+
    |                        └---------o | id (PK)           TEXT |
    |                                    | member_id (FK)    TEXT |
    |                                    | session_id (FK)   TEXT |
    |                                    | category          TEXT |
    |                                    | narrativeEncryptedBYTE|
    |                                    | embedding   VECTOR(384)|
    |                                    +------------------------+
    |
    |                                    +---------------------------+
    |                                    | MemberLongitudinalProfile |
    |                                    +---------------------------+
    └----------------------------------o | id (PK)              TEXT |
                                         | member_id (FK-Unique)TEXT |
                                         | presenting_conditionsTEXT[]|
                                         | core_wounds        TEXT[] |
                                         | overallProgressScoreFLOAT |
                                         | current_risk_tier    TEXT |
                                         +---------------------------+
    |
    |------------------------+
    |                        |
    |                        |           +------------------------+
    |                        |           |      SessionNote       |
    |                        |           +------------------------+
    |                        ├---------o | id (PK)           TEXT |
    |                        |           | sessionId (FK-UK) TEXT |
    |                        |           | coachId (FK)      TEXT |
    |                        |           | memberId (FK)     TEXT |
    |                        |           | status            TEXT |
    |                        |           +------------------------+
    |                        |               ^
    |                        |               | (one-to-many)
    |                        |               +-----------+
    |                        |                           |
    |                        |           +---------------v-----------+
    |                        |           |    MemberChangeInsight    |
    |                        |           +---------------------------+
    |                        └---------o | id (PK)              TEXT |
    |                                    | memberId (FK)        TEXT |
    |                                    | sessionNoteIdA(FK-O) TEXT |
    |                                    | sessionNoteIdB(FK-N) TEXT |
    |                                    | summary              TEXT |
    |                                    | improvements        JSONB |
    |                                    | concerns            JSONB |
    |                                    | goals               JSONB |
    |                                    | behavioralPatterns  JSONB |
    |                                    | safetyFlags         JSONB |
    |                                    | hasSafetyAlert    BOOLEAN |
    |                                    +---------------------------+

+------------------------+               +------------------------+
|     InferenceEvent     |               |      EventSignal       |
+------------------------+               +------------------------+
| id (PK)            INT | <-----------o | id (PK)            INT |
| event_id (UK)     TEXT |               | event_id (FK)      INT |
| member_token      TEXT |               | signal_code       TEXT |
| source_type       TEXT |               | confidence     NUMERIC |
| risk_tier         TEXT |               +------------------------+
| risk_score     NUMERIC |
+------------------------+
    ^
    |
    |                                    +------------------------+
    |                                    |    ShapAttribution     |
    |                                    +------------------------+
    ├──────────────────────────────────o | id (PK)            INT |
    |                                    | event_id (FK)      INT |
    |                                    | span              TEXT |
    |                                    | weight         NUMERIC |
    |                                    +------------------------+
    |
    |                                    +------------------------+
    |                                    |      ReviewAction      |
    |                                    +------------------------+
    └──────────────────────────────────o | id (PK)            INT |
                                         | event_id (FK)      INT |
                                         | therapist_id      TEXT |
                                         | action            TEXT |
                                         +------------------------+
```

### Table Definitions (Key DB Tables)
* **`patient_consent`**: Logs patient consent preferences (e.g., `recording`, `ai_analysis`).
* **`session_live_episodes`**: Stores the 2-minute L2 session summaries generated during active calls.
* **`member_memory_events`**: Holds encrypted, vector-embedded clinical events (L3a) extracted at the end of sessions.
* **`member_longitudinal_profile`**: Stores the client's summarized clinical history (presenting conditions, core wounds, recurring themes, progress score).
* **`inference_events`**: Contains structured classifications for text ingestion points.
* **`SessionNote`**: Stores draft and finalized coach session notes (summaries, observations, recommendations) with automated versioning tracking.
* **`MemberChangeInsight`**: Holds AI-detected session-to-session progress reviews (improvements, setbacks/concerns, goals, behavioral shifts, and safety flags) generated when note comparisons are triggered.

---

## 7. AI & Machine Learning Architecture

SafeCircle's machine learning architecture combines real-time streaming feature extraction with generative RAG-based reasoning.

### AI Features Overview
```
           ┌── Acoustic Features (librosa / pydub) ────┐
           ├── Facial Emotion (Frontend FaceDetector)  ┼──➔ [Real-Time Inference Layer]
           └── Speech Text (Deepgram Nova-3 ASR) ──────┘
                                                                │
                                                                ▼
                                                    [Clinical RAG Synthesis]
                                                     (History + Memory Events)
                                                                │
                                                                ▼
                                                    [Actionable Dashboard Alerts]
```

### Model Architecture
The system uses the following configuration:
* **Feature Extraction Models**:
  * **ASR Model**: Deepgram Nova-3 (Streaming, 16kHz, linear16).
  * **Acoustic Extractor**: PyIN Pitch estimator, Root-Mean-Square (RMS) Energy estimator.
* **Clinical Reasoning Models**:
  * **Primary (RAG & Ingestion)**: Llama 3.1 8B/70B (via Groq) for low-latency inference.
  * **Fallback**: Gemini 2.0/2.5 (via OpenRouter/Google AI Studio) for comprehensive profiles.

---

### In-Depth Pipelines

#### Emotion Detection System
SafeCircle uses a dual-domain emotion classification framework:

```
[Audio Capture] ➔ [PyIN F0 Estimator] ➔ Pitch Mean/Std
                ➔ [RMS Windowing]      ➔ Energy Mean/Trend ➔ [Affect Classifier] ➔ Vocal Valence
                                                                     │
[Visual Frame]  ➔ [Face Mesh Sampling] ➔ Geometry vectors ➔ [Softmax Map]       ➔ Dominant Emotion
```

* **Vocal Features (Acoustic Domain)**:
  * **Pitch (F0)**: Extracted via the PyIN algorithm (C2–C7 notes) inside `tone_analyzer.py`. Rapid pitch shifts indicate voice breaks or tremors.
  * **Energy**: Calculated via hop-window RMS. Rising energy trends indicate agitation or panic.
  * **Pause Ratio**: Measures silence frames (RMS < 0.02) to detect cognitive slowing or hesitation.
* **Visual Features (MediaPipe & HSEmotion Backend Classifier)**:
  * **Dynamic WASM Import**: Dynamically downloads the MediaPipe Tasks-Vision WASM compiler from standard jsdelivr CDN at runtime to map 478 3D facial landmarks from client streams.
  * **Image Ingestion**: The client client-side captures video frames, converts them to base64, and POSTs them to the backend API (`/api/emotion/detect`).
  * **Model Architecture**: The Python backend evaluates frames using the **HSEmotion Recognizer** (specifically the `enet_b2_8` EfficientNet-B2 PyTorch model), run inside a thread-safe `ThreadPoolExecutor` background pool (16 workers) to ensure sub-100ms concurrent inference without blocking the async event loop.
  * **Softmax Emotion Mapping**: Maps raw models outputs to standardized clinical affect states: Neutral, Happy, Sad, Angry, Contempt, Disgust, Fear, and Surprise.
  * **In-Memory Buffering & Clock Correction**: Backend services buffer incoming emotion packets in `_session_buffers`, keeping a rolling window of the last 120 seconds (max 10 signals) per participant. The system dynamically computes network clock skew (`_clock_skews`) on the first packet and normalizes client timestamps to the server clock.
  - **Incongruence Detection & Live Integration**: During active sessions, the `LiveMeetingAnalysisEngine` fetches video emotion counts over the last 30 seconds and injects `video_context` into the Strands RAG agent alongside acoustic tone and transcript text. This enables detection of affect incongruence (e.g., patient claiming to feel happy while displaying fear/anger facially).
  - **Analysis safety net**: Includes a safety net that force-triggers a RAG analysis if 120 seconds have elapsed since the last success, regardless of activity thresholds.
* **Affect Congruence**: Matches text sentiment (TextBlob polarity) against vocal valence. Mismatches (e.g., negative words with laughter) trigger "masking" alerts:
  $$\text{Congruence} = 1.0 - \frac{|\text{Sentiment}_{\text{text}} - \text{Valence}_{\text{vocal}}|}{2.0}$$

---

#### Risk Detection System
Ingested events are evaluated across five clinical dimensions:
1. **Hopelessness (HOP)**: E.g., worthlessness (`HOP-04`), passive death wishes (`HOP-08`).
2. **Isolation (ISO)**: Burdensomeness (`ISO-02`), digital isolation (`ISO-09`).
3. **Self-Harm (SHA)**: Coded self-harm (`SHA-03`), NSSI (`SHA-05`).
4. **Crisis Escalation (CRS)**: Access to means (`CRS-04`), farewell behavior (`CRS-05`).
5. **Cultural Modifiers (CCM)**: Slang usage (e.g., "unaliving", "cooked") mapped using specialized slang dictionaries.

```
Risk Scores & Action Matrix:
┌──────────────┬──────────────────┬─────────────────────────────┐
│ Score Range  │ Tier Class       │ Escalation Action           │
├──────────────┼──────────────────┼─────────────────────────────┤
│ 0.85 – 1.00  │ CRISIS           │ immediate_crisis_protocol   │
│ 0.65 – 0.84  │ HIGH             │ urgent_clinician_review     │
│ 0.35 – 0.64  │ MODERATE         │ schedule_followup           │
│ 0.00 – 0.34  │ LOW              │ no_action                   │
└──────────────┴──────────────────┴─────────────────────────────┘
```

##### Aggregator Scoring Formula
The system aggregates risk scores across multiple communication channels (chat, mood journals, and assessments) using time decay:

$$\text{Score}_{\text{composite}} = \frac{\sum (S_i \cdot W_i \cdot e^{-\lambda t})}{\sum (W_i \cdot e^{-\lambda t})}$$

Where:
* $S_i$: Raw score of the source.
* $W_i$: Base weight of the source (Chat: `0.40`, Mood: `0.20`, Assessments: `0.40`).
* $\lambda$: Decay rate based on source half-life (Chat: 7 days, Assessments: 30 days).
* $t$: Age of the event in days.

##### Safeguard Rules
1. **Crisis Override**: Any single event score $\ge 0.85$ in the last 24 hours forces the composite score to `1.0`.
2. **Score Floor**: A GAD-7 or PHQ-8 score $\ge 15$ floors the composite score at `0.35` (Moderate risk).

---

#### Memory Storage Architecture (L1 ➔ L2 ➔ L3)
SafeCircle maps clinical memory across three distinct temporal layers:

```
┌────────────────────────────────────────────────────────┐
│ L1: Working Buffer (Last 60 seconds of transcript)     │
└──────────────────────────┬─────────────────────────────┘
                           │ (Processed every 2 minutes)
                           ▼
┌────────────────────────────────────────────────────────┐
│ L2: Live Episodes (Session summaries in database)       │
└──────────────────────────┬─────────────────────────────┘
                           │ (Analyzed at session end)
                           ▼
┌────────────────────────────────────────────────────────┐
│ L3a: Significant Events (Encrypted & vector-embedded) │
└──────────────────────────┬─────────────────────────────┘
                           │ (Profile rollup synthesis)
                           ▼
┌────────────────────────────────────────────────────────┐
│ L3b: Longitudinal Profile (Presenting conditions)      │
└────────────────────────────────────────────────────────┘
```

* **L1: Working Buffer**: Temporary, in-memory sliding window containing the last 60 seconds of the session transcript.
* **L2: Live Episodes**: Structured database summaries generated every 2 minutes. The LLM compresses the L1 text into a 3-4 sentence clinical summary, categorizes it by sentiment, and extracts themes.
* **L3a: Significant Memory Events**: Triggered when a session ends. The LLM parses all L2 summaries from the session, extracts key clinical developments (e.g., Breakthroughs, Disclosures, Turning Points, and Risk Signals), encrypts the narratives, and embeds them as 384-dimensional vectors.
* **L3b: Longitudinal Profile**: Rollup synthesized after session-end L3a extraction. The system decrypts historical memory events, processes them with the LLM, and updates the patient's long-term clinical profile.

---

#### Real-Time Processing Sequence
The diagram below illustrates the path from spoken words to dashboard updates:

```
[User Mic]
    │
    ▼
(FastAPI STT Gateway) ──➔ [Deepgram ASR] ➔ Raw Transcript
    │
    ├─➔ [Tone Analyzer] ➔ Acoustic Features ──┐
    │                                         ▼
    │                         [RAG Prompt Contextualizer]
    │                         * Decrypts L3a memory events
    │                         * Fetches L3b longitudinal profile
    │                         * Extracts recent L2 summaries
    │                                         │
    │                                         ▼
    │                                 [Strands RAG Agent]
    │                                         │
    │                                         ▼
    └───────────────────────────────➔ [Live Suggestions] ➔ (WS Broadcast) ➔ [Coach Dashboard]
```

---

## 9. Real-Time Features

### WebSockets
* **Live STT Connection**: Open WebSocket endpoint (`/v1/stt`) accepting binary PCM-16 audio packets.
* **WebSocket Keepalives**: Client sends keepalive pings every 3 seconds to prevent network disconnects.
* **Connection Lifecycle**: Validates client authentication JWTs, verifies patient consent, authorizes the session, and streams audio to Deepgram.

### SSE Stream Updates
Coaches view live risk scores and clinical insights via Server-Sent Events (SSE). The Python backend publishes event signals to Redis Pub/Sub, which are routed to the frontend client through a persistent SSE stream (`/api/scores/stream`).

---

## 11. Project Workflow

```
[1. User Logs In]
        │
        ▼
[2. Session Starts] ──➔ (Grants mic/camera access & validates consent)
        │
        ▼
[3. Session In-Progress]
        ├── Streaming: Audio chunks streamed to `/v1/stt`
        ├── Analysis: Tone Analyzer processes vocal characteristics
        └── Suggested prompts stream to Coach Dashboard
        │
        ▼
[4. Session Concludes]
        ├── L3a Extraction: Identifies breakthroughs/disclosures, encrypts text, saves vectors
        └── L3b Rollup: Recomputes overall progress scores and updates clinical profile
```

---

## 12. Feature-by-Feature Deep Dive

### 1. Ingestion Pipeline
* **Purpose**: Collects and analyzes text from various patient touchpoints (posts, chats, journals, assessments).
* **Technical Implementation**:
  * FastAPI endpoints: `/v1/ingest/peer-post`, `/v1/ingest/journal`, `/v1/ingest/chat`, `/v1/ingest/assessment`.
  * Checks user consent, runs LLM risk classification, returns response with timing statistics, and processes database writes in the background.

```python
# API Ingestion Handler (FastAPI)
@router.post("/chat", response_model=IngestOut, status_code=202)
async def ingest_chat(
    payload: ChatIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify patient has active consent
    _consent_check(payload.consent_active, payload.event_id)
    
    # 2. Run LLM risk assessment & save results in background
    return await _infer_and_store(
        raw_text=payload.text,
        source_type="chat",
        payload=payload,
        background_tasks=background_tasks,
        session_id=payload.session_id,
        role=payload.role
    )
```

### 2. Live Session Monitor
* **Purpose**: Provides real-time transcription and clinical guidance to coaches during active sessions.
* **Technical Implementation**:
  * Next.js WebRTC client captures audio; streams it to the backend via WebSocket.
  * Backend routes audio to Deepgram, runs acoustic feature extraction, and updates the session's live analysis history.

### 3. Consent and Data Security
* **Purpose**: Ensures HIPAA compliance and gives patients control over their data.
* **Technical Implementation**:
  * Database-level pgsodium/pgcrypto routines encrypt PHI data (e.g., narrative text, quotes).
  * Postgres Row Level Security (RLS) policies prevent unauthorized access to consent records.

```sql
-- Encryption and RLS Migration (PostgreSQL)
CREATE TABLE IF NOT EXISTS public.patient_consent (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  patient_id      TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  consent_type    TEXT NOT NULL,
  granted         BOOLEAN NOT NULL DEFAULT false,
  revoked_at      TIMESTAMPTZ,
  CONSTRAINT patient_consent_pkey PRIMARY KEY (id)
);

ALTER TABLE public.patient_consent ENABLE ROW LEVEL SECURITY;

-- Allow members to read their own consent records
CREATE POLICY member_reads_own_consent ON public.patient_consent
  FOR SELECT USING (patient_id = (SELECT auth.uid()::text));
```

### 4. Session-to-Session Change Insights
* **Purpose**: Tracks longitudinal client progress, setbacks, behavioral patterns, and safety flags across sequential sessions.
* **Technical Implementation**:
  * **Strands Clinical Agent**: Orchestrated using LiteLLM. Initiated when a coach triggers comparison between Note A (previous finalized session note version) and Note B (current draft session note version).
  * **Report Structure**: Formulates structural sections: Narrative change summary, Improvements list, Concerns/Setbacks list, Goal progress, Behavioral patterns, and Safety flags.
  * **Dedicated Safety Net Classifier**: Compares Note B text against a static dictionary of crisis keywords (`"suicide"`, `"kill"`, `"harm"`, `"die"`, `"end my life"`, `"end it all"`, `"self-harm"`, `"cutting"`, `"overdose"`). If a match is found, it automatically raises `hasSafetyAlert = true` and appends safety flags, preventing LLM classifier misses.
  * **Consent Gate**: Verifies active client consent check for AI Clinical Analysis (`consentType: "ai_analysis"`).
  * **HIPAA Compliance & Audit Trigger**:
    - `MemberChangeInsight` records are subject to Row-Level Security (RLS) policies: selective read restricted to assigned coaches (`coach_reads_assigned_insights`) or the owner member (`member_reads_own_insights`).
    - Database audit trigger `audit_change_insights` runs after insert/update/delete, calling `log_phi_access()` to record clinical access paths.
    - Soft delete constraints prevent hard deletion of clinical history records (`FOR DELETE USING (false)` policy).
