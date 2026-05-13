import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface OrganizationState {
  currentOrgName: string;
}

const initialState: OrganizationState = {
  currentOrgName: "State University System",
};

const organizationSlice = createSlice({
  name: "organization",
  initialState,
  reducers: {
    setCurrentOrgName(state, action: PayloadAction<string>) {
      state.currentOrgName = action.payload;
    },
  },
});

export const { setCurrentOrgName } = organizationSlice.actions;
export default organizationSlice.reducer;
