import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ModalKey = "add-coach" | "add-group" | "edit-group" | "confirm" | null;

interface UiState {
  sidebarMobileOpen: boolean;
  sidebarMinimized: boolean;
  modal: ModalKey;
  confirmModal?: { title: string; message: string; onConfirm?: string };
}

const initialState: UiState = {
  sidebarMobileOpen: false,
  sidebarMinimized: false,
  modal: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSidebarMobileOpen(state, action: PayloadAction<boolean>) {
      state.sidebarMobileOpen = action.payload;
    },
    toggleSidebarMinimized(state) {
      state.sidebarMinimized = !state.sidebarMinimized;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar-minimized", String(state.sidebarMinimized));
      }
    },
    setSidebarMinimized(state, action: PayloadAction<boolean>) {
      state.sidebarMinimized = action.payload;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar-minimized", String(state.sidebarMinimized));
      }
    },
    openModal(state, action: PayloadAction<ModalKey>) {
      state.modal = action.payload;
    },
    closeModal(state) {
      state.modal = null;
    },
  },
});

export const { 
  setSidebarMobileOpen, 
  toggleSidebarMinimized, 
  setSidebarMinimized, 
  openModal, 
  closeModal 
} = uiSlice.actions;
export default uiSlice.reducer;

