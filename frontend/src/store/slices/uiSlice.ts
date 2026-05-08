import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ModalKey = "add-coach" | "add-group" | "confirm" | null;

interface UiState {
  sidebarMobileOpen: boolean;
  modal: ModalKey;
  confirmModal?: { title: string; message: string; onConfirm?: string };
}

const initialState: UiState = {
  sidebarMobileOpen: false,
  modal: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSidebarMobileOpen(state, action: PayloadAction<boolean>) {
      state.sidebarMobileOpen = action.payload;
    },
    openModal(state, action: PayloadAction<ModalKey>) {
      state.modal = action.payload;
    },
    closeModal(state) {
      state.modal = null;
    },
  },
});

export const { setSidebarMobileOpen, openModal, closeModal } = uiSlice.actions;
export default uiSlice.reducer;
