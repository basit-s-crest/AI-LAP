import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthSession, AuthUser } from "@/types/auth";
import {
  AUTH_ROLE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_JSON_KEY,
  AUTH_USER_NAME_KEY,
} from "@/constants/storage";
import { deleteClientCookie, setClientCookie } from "@/utils/cookies";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  impersonationLabel: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  impersonationLabel: null,
};

function persistSession(session: AuthSession) {
  setClientCookie(AUTH_TOKEN_KEY, session.token, COOKIE_MAX_AGE);
  setClientCookie(AUTH_ROLE_KEY, session.user.role, COOKIE_MAX_AGE);
  setClientCookie(
    AUTH_USER_NAME_KEY,
    `${session.user.firstName} ${session.user.lastName}`.trim(),
    COOKIE_MAX_AGE
  );
  setClientCookie(AUTH_USER_JSON_KEY, JSON.stringify(session.user), COOKIE_MAX_AGE);
}

function clearPersisted() {
  deleteClientCookie(AUTH_TOKEN_KEY);
  deleteClientCookie(AUTH_ROLE_KEY);
  deleteClientCookie(AUTH_USER_NAME_KEY);
  deleteClientCookie(AUTH_USER_JSON_KEY);
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<AuthSession>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      persistSession(action.payload);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.impersonationLabel = null;
      clearPersisted();
    },
    hydrateFromStorage(
      state,
      action: PayloadAction<{ user: AuthUser; token: string } | null>
    ) {
      if (action.payload) {
        state.user = action.payload.user;
        state.token = action.payload.token;
      }
    },
    setImpersonation(state, action: PayloadAction<string | null>) {
      state.impersonationLabel = action.payload;
    },
  },
});

export const { setSession, logout, hydrateFromStorage, setImpersonation } = authSlice.actions;
export default authSlice.reducer;
