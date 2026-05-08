import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface CoachState {
  onDemand: boolean;
}

const initialState: CoachState = {
  onDemand: true,
};

const coachSlice = createSlice({
  name: "coach",
  initialState,
  reducers: {
    setOnDemand(state, action: PayloadAction<boolean>) {
      state.onDemand = action.payload;
    },
  },
});

export const { setOnDemand } = coachSlice.actions;
export default coachSlice.reducer;
