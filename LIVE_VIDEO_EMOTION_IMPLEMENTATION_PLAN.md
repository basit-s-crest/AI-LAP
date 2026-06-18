# Live Video Emotion & Behavior Analysis Implementation Plan

This document outlines the revised research, architecture, and phase-by-phase implementation plan for integrating live video emotion and behavior analysis into the coaching session workflow.

---

## 1. Current Project Folder Structure Study

The project consists of three major components:
1. **Frontend FE** (`frontend/FE`): Next.js React application.
2. **Frontend BE** (`frontend/BE`): Express & Prisma (Node.js) application.
3. **Python Backend** (`backend/`): FastAPI application handling real-time STT streaming and Live LLM observations.

Below are the key files and directories relevant to each domain:

### Frontend Relevant Folders/Files (`frontend/FE`)
- [SessionVideoCall.tsx](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/FE/src/components/livekit/SessionVideoCall.tsx): Handles LiveKit connection, local/remote video/audio track display, and controls (mic/camera toggles).
- [MeetingModal.tsx](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/FE/src/components/session/MeetingModal.tsx): Main meeting dashboard layout that splits the screen between the video call and the transcription/notes panel.
- [LiveSessionTranscript.tsx](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/FE/src/components/session/LiveSessionTranscript.tsx): Tabbed UI displaying the Live Transcript and real-time AI Insights.
- [useLiveTranscription.ts](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/FE/src/hooks/useLiveTranscription.ts): Handles STT WebSocket connection to Python backend, MediaRecorder, sending audio chunks, and receiving transcripts and live analysis.

### Backend Relevant Folders/Files (`frontend/BE`)
- [livekit.controller.ts](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/BE/src/controllers/livekit.controller.ts): Handles generation of LiveKit tokens and short-lived transcription JWT tokens.
- [aiSessionNote.controller.ts](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/BE/src/controllers/aiSessionNote.controller.ts): Generates post-session summaries via LLM (Grok/Claude/Mock) and saves notes to PostgreSQL.
- [schema.prisma](file:///c:/Users/IshitaBhojani/AI-LAP/frontend/BE/prisma/schema.prisma): Database models defining `Session` and `AiSessionNote`.

### Python Backend Relevant Folders/Files (`backend/`)
- [main.py](file:///c:/Users/IshitaBhojani/AI-LAP/backend/main.py): FastAPI app initialization and route registration.
- [router.py](file:///c:/Users/IshitaBhojani/AI-LAP/backend/app/api/v1/router.py): Central registry for FastAPI v1 routers.
- [router.py](file:///c:/Users/IshitaBhojani/AI-LAP/backend/app/modules/stt/router.py): WebSocket endpoint (`/v1/stt`) proxying audio streams to Deepgram and routing finals to the live analysis engine.
- [live_analysis.py](file:///c:/Users/IshitaBhojani/AI-LAP/backend/app/modules/live_analysis/live_analysis.py): Buffers transcripts and runs periodic mental status risk checks.

---

## 2. Existing Flow Explanation

### How Video Session Starts & Participants Join
1. **Coach Action**: The coach starts a session in Next.js, making a POST request to `/api/sessions/:id/livekit/start` on the Express BE.
2. **Member Action**: The member joins, making a POST request to `/api/sessions/:id/livekit/token` on the Express BE.
3. **Response**: Express BE returns a LiveKit access token and a short-lived transcription JWT (signed with a shared `JWT_SECRET`).
4. **Connection**: Both participants connect to the LiveKit SFU room via `<LiveKitRoom>` in their respective client UIs.

### How LiveKit Tracks & STT Work
1. **Video/Audio Tracks**: In `SessionVideoCall.tsx`, local and remote video tracks are grabbed via `useTracks` and rendered using `<VideoTrack />`.
2. **Audio Track Retrieval**: The remote member's audio track is extracted inside `SessionVideoCall.tsx` and exposed via `onRemoteStream(stream)` up to `MeetingModal.tsx`.
3. **STT Connection**: When recording starts, `MeetingModal.tsx` passes the `remoteStream` to `<LiveSessionTranscript />`, which calls the `useLiveTranscription` hook.
4. **WebSocket Streaming**: The hook instantiates `MediaRecorder` on the audio track and streams WebM audio chunks to the Python WebSocket proxy (`ws://localhost:8001/v1/stt`) with authorization query parameters.
5. **Proxy Forwarding**: The Python backend forwards audio to Deepgram Nova-3.

### How Live AI Insights Work
1. **Live Transcripts**: Final transcripts from Deepgram are returned via WebSocket to the frontend.
2. **Live LLM Observations**: In the Python backend, the incoming final transcripts are buffered. Every 5 lines or 40 words, `LiveMeetingAnalysisEngine` performs a prompt-based LLM analysis (via Groq Llama-3.1 or fallback Gemini/OpenRouter).
3. **WebSocket Return**: The LLM output is emitted back over the STT WebSocket as a JSON payload of type `"live_analysis"`.
4. **Frontend Display**: `LiveSessionTranscript.tsx` receives this payload and logs it under the **AI Insights** tab.

### Where Live Emotion Analysis Can Be Inserted Safely
- **Frontend Frame Sampling**: We can capture frames from the remote participant's video track in `SessionVideoCall.tsx` or `MeetingModal.tsx` where the track object is already available.
- **WebSocket Protocol Multiplexing**: The STT WebSocket proxy is already running and established between the browser and the Python backend (`/v1/stt`). We can multiplex visual frames (`type: "video_frame"`) and returned signals (`type: "emotion_signal"`) over this single, shared connection. This prevents connection overhead and maintains core system stability.

---

## 3. Recommended Simple Architecture

### Browser Frame Sampler
- A React utility hook (`useVideoFrameSampler.ts`) binds to the active remote participant's video track.
- Draws frames to an offscreen canvas at a low frequency (e.g., 1 frame every 4 seconds) at low resolution (e.g., 320x240, JPEG, quality 0.5) to keep bandwidth consumption minimal.
- **Consent/Feature Flag Gate**: Active only when `enableLiveVideoAnalysis === true` (client consent checkbox active).

### Shared WebSocket Proxy
- Multiplexes frame payloads over the existing `/v1/stt` connection as:
  `{ type: "video_frame", frame: "data:image/jpeg;base64,..." }`
- Receives returned emotion signals as:
  `{ type: "emotion_signal", data: { emotion: "Calm" | "Anxious" | "Distressed" | "Neutral", face_detected: boolean } }`
- **Zero Raw Storage**: Raw video frames/images are processed strictly in-memory and immediately discarded. No visual files are persisted.

### Backend Analysis
- The Python WebSocket handler parses incoming frame payloads, updates consent checks, and forwards frames to the analyzer.
- The analyzer processes the frame in-memory and executes a mock or heuristic classifier that is plug-and-play.
- **Optional Future Enhancement**: Gemini Vision API or local ONNX runtimes can be substituted later. For initial phases, a simple local/mock engine guarantees maximum stability.

### Frontend state & Coach UI
- Frontend maintains a short history of recent emotion signals.
- In `LiveSessionTranscript.tsx`, the **AI Insights** panel is updated to show the "Emotional Climate" containing non-diagnostic qualitative tags (Calm, Anxious, Distressed, Neutral).

---

## 4. Risk Corrections

- **Gemini Vision Constraints**: While powerful, integrating Gemini Vision in Phase 3/4 introduces external API dependencies, increased runtime cost, network latency (1-2s per frame), and complex privacy reviews. Therefore, it is documented strictly as a **future enhancement**, not the default implementation path.
- **Pipeline Validation**: The initial implementation proves the correctness of the pipeline (sampler -> WS multiplexing -> backend routing -> UI rendering) using local heuristic/mock signals first, eliminating AI model latency or API failures as variables.
- **Plug-and-Play Backend**: The backend frame analyzer is decoupled so that we can plug in advanced models (such as Gemini Vision, face-api, or lightweight ONNX models) at a later date without modifying the frontend sampler or WebSocket schema.
- **Non-Interruption Guarantee**: The STT audio pipeline, transcript delivery, LiveKit calling, and post-session note logic must run in separate streams/handlers so that any failure in video sampling or frame classification is ignored, and has a graceful fallback.

---

## 5. Phase-by-Phase Implementation Plan

### Phase 0 — R&D Only
- Study existing folder structure, track handling, and STT WS proxy.
- Draft implementation plan and acquire coach review.
- **No code changes.**

### Phase 1 — Frontend Frame Sampler Only
- Create `videoFrameSampler.ts` utility.
- Expose the remote participant's video track reference in `SessionVideoCall.tsx` to `MeetingModal.tsx`.
- Create a client-side feature flag `enableLiveVideoAnalysis` (controlled by a client consent checkbox in `MeetingModal.tsx`).
- Verify canvas frames are captured locally (in console logs) at low-frequency (every 4 seconds) and low-resolution (320x240). No data is sent over the network.

### Phase 2 — Mock/Local Heuristic Emotion Signal
- Implement a mock/local heuristic analyzer in `useLiveVideoAnalysis.ts` to simulate signals (`Calm`, `Anxious`, `Neutral`).
- Render local debug console logs or a temporary developer UI container to verify the capture-and-heuristic loop.
- Production UI for the coach remains clean.

### Phase 3 — Multiplex `video_frame` Message Through Existing `/v1/stt` WebSocket
- Expand client `useLiveTranscription` messaging schema to serialize and send JSON payloads:
  `{ type: "video_frame", frame: "data:image/jpeg;base64,..." }`
- Run checks to ensure that multiplexing these frames over the active STT WebSocket does not degrade ASR performance or block transcription delivery.

### Phase 4 — Lightweight Backend Analysis or Mock Backend Parser
- Modify the Python backend `websocket_endpoint` in `stt/router.py` to parse JSON payloads and detect `"video_frame"` types.
- Add mock/heuristic classification in the backend `LiveMeetingAnalysisEngine`.
- Return mock emotion signals over the same WebSocket:
  `{ type: "emotion_signal", data: { emotion: "Calm", face_detected: true } }`
- Ensure raw frames are processed entirely in-memory and immediately discarded.

### Phase 5 — Coach AI Insights UI Integration
- Add an "Emotional Climate" card/section inside the coach-facing **AI Insights** tab in `LiveSessionTranscript.tsx`.
- Display simple, non-clinical labels: Calm, Anxious, Distressed, Neutral.
- Strictly avoid raw confidence percentages, scores, or clinical diagnostic jargon.

### Phase 6 — Session Summary Aggregation
- Aggregate the session's emotion distribution metrics on the frontend.
- Append the summary data (e.g. Calm vs Anxious duration percentage) to the payload sent to POST `/api/ai-session-notes`.
- Modify Express BE's note generation prompts to incorporate these aggregate emotion indicators into the final generated session notes.

---

## 6. Exact Files to Create/Change

| Phase | File Path | Action | Purpose | Risk Level | Approval Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | `frontend/FE/src/utils/videoFrameSampler.ts` | **[NEW]** | Browser frame capture utility from video tracks | Low | Yes |
| **Phase 1** | `frontend/FE/src/components/livekit/SessionVideoCall.tsx` | **[MODIFY]** | Bubble up the remote participant's video track | Moderate | Yes |
| **Phase 1** | `frontend/FE/src/components/session/MeetingModal.tsx` | **[MODIFY]** | Manage frame sampling lifecycle and feature flag | Moderate | Yes |
| **Phase 2** | `frontend/FE/src/hooks/useLiveVideoAnalysis.ts` | **[NEW]** | Local mock analysis hook for frontend debugging | Low | Yes |
| **Phase 3** | `frontend/FE/src/hooks/useLiveTranscription.ts` | **[MODIFY]** | Multiplex frames over STT WebSocket | Moderate | Yes |
| **Phase 4** | `backend/app/modules/stt/router.py` | **[MODIFY]** | Handle video frame WebSocket frames on STT proxy | Moderate | Yes |
| **Phase 4** | `backend/app/modules/live_analysis/live_analysis.py` | **[MODIFY]** | Process and mock-classify frames in-memory | Low | Yes |
| **Phase 5** | `frontend/FE/src/components/session/LiveSessionTranscript.tsx` | **[MODIFY]** | Add Emotional Climate card to AI Insights UI | Low | Yes |
| **Phase 6** | `frontend/BE/src/controllers/aiSessionNote.controller.ts` | **[MODIFY]** | Integrate session emotion trends into final AI notes | Moderate | Yes |

---

## 7. Implementation Checklist

- [x] Study current folder structure
- [x] Identify LiveKit track source
- [x] Identify coach UI insertion point
- [x] Identify backend event/API flow
- [x] Decide local vs backend analysis path
- [x] Create feature flag
- [ ] Implement phase 1 only after approval

---

## 8. Ask for Approval

Please review this implementation plan. I will not start code changes until you approve Phase 1.
