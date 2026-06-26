import api from "@/lib/api";
import type {
  SessionNoteDTO,
  SessionNoteVersionDTO,
  SaveSessionNotePayload,
  CreateSessionNotePayload,
  UpdateSessionNotePayload,
} from "@/types/sessionNote";

export const sessionNoteService = {
  // Generic endpoints for manual dashboard notes
  async listForCoach(coachId: string): Promise<SessionNoteDTO[]> {
    const { data } = await api.get<{ notes: SessionNoteDTO[] }>("/api/session-notes");
    return data.notes;
  },

  async create(payload: CreateSessionNotePayload): Promise<SessionNoteDTO> {
    const { data } = await api.post<{ note: SessionNoteDTO }>(
      "/api/session-notes",
      payload
    );
    return data.note;
  },

  async update(id: string, payload: UpdateSessionNotePayload): Promise<SessionNoteDTO> {
    const { data } = await api.patch<{ note: SessionNoteDTO }>(
      `/api/session-notes/${encodeURIComponent(id)}`,
      payload
    );
    return data.note;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/session-notes/${encodeURIComponent(id)}`);
  },

  // Versioned session note endpoints
  async getSessionNote(sessionId: string): Promise<{
    exists: boolean;
    note?: SessionNoteDTO;
    prefillData?: {
      aiSessionNoteId: string;
      summary: string;
      keyThemes: string[];
      memberSentiment: string;
      coachObservations: string;
      riskFlag: boolean;
      riskNotes: string;
      recommendedFollowUp: string;
      emotionTimeline?: any;
      emotionCounts?: any;
    } | null;
  }> {
    const { data } = await api.get<{
      exists: boolean;
      note?: SessionNoteDTO;
      prefillData?: any;
    }>(`/api/session-notes/session/${encodeURIComponent(sessionId)}`);
    return data;
  },

  async saveSessionNote(
    sessionId: string,
    payload: SaveSessionNotePayload
  ): Promise<SessionNoteDTO> {
    const { data } = await api.post<{ note: SessionNoteDTO }>(
      `/api/session-notes/session/${encodeURIComponent(sessionId)}`,
      payload
    );
    return data.note;
  },

  async getSessionNoteVersions(sessionId: string): Promise<SessionNoteVersionDTO[]> {
    const { data } = await api.get<{ versions: SessionNoteVersionDTO[] }>(
      `/api/session-notes/session/${encodeURIComponent(sessionId)}/versions`
    );
    return data.versions;
  },

  async getSessionNotes(): Promise<SessionNoteDTO[]> {
    const { data } = await api.get<{ notes: SessionNoteDTO[] }>("/api/session-notes");
    return data.notes;
  },
};
