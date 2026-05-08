import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  selectedId: number | null;
}

const initialState: UserState = {
  selectedId: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setSelectedUser(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
  },
});

export const { setSelectedUser } = userSlice.actions;
export default userSlice.reducer;
