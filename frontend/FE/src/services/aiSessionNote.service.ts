import api from "@/lib/api";
import type {
  CreateAiSessionNotePayload,
  AiSessionNoteDTO,
} from "@/types/sessionNote";

export const aiSessionNoteService = {
  async create(payload: CreateAiSessionNotePayload): Promise<AiSessionNoteDTO> {
    const { data } = await api.post<{ note: AiSessionNoteDTO }>(
      "/api/ai-session-notes",
      payload
    );
    return data.note;
  },

  async getBySessionId(sessionId: string): Promise<AiSessionNoteDTO> {
    const { data } = await api.get<{ note: AiSessionNoteDTO }>(
      `/api/ai-session-notes/session/${encodeURIComponent(sessionId)}`
    );
    return data.note;
  },
};
