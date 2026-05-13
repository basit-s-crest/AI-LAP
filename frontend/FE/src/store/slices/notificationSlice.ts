import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppNotification } from "@/types/notification";

interface NotificationState {
  items: AppNotification[];
}

const initialState: NotificationState = {
  items: [],
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<AppNotification[]>) {
      state.items = action.payload;
    },
    markRead(state, action: PayloadAction<string>) {
      const n = state.items.find((x) => x.id === action.payload);
      if (n) n.read = true;
    },
  },
});

export const { setNotifications, markRead } = notificationSlice.actions;
export default notificationSlice.reducer;
