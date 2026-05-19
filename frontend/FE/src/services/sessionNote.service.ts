import api from "@/lib/api";
import type {
  CreateSessionNotePayload,
  SessionNoteDTO,
  UpdateSessionNotePayload,
} from "@/types/sessionNote";

export const sessionNoteService = {
  async listForCoach(coachId: string): Promise<SessionNoteDTO[]> {
    const { data } = await api.get<{ notes: SessionNoteDTO[] }>(
      `/api/session-notes/coach/${encodeURIComponent(coachId)}`
    );
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
};
