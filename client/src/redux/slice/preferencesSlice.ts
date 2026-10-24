import { createSlice, PayloadAction } from "@reduxjs/toolkit";
const s = createSlice({
  name: "preferences",
  initialState: { language: "en" as "en" | "ur", dark: false },
  reducers: {
    setLanguage(x, a: PayloadAction<"en" | "ur">) {
      x.language = a.payload;
    },
    toggleTheme(x) {
      x.dark = !x.dark;
    },
  },
});
export const preferenceActions = s.actions;
export default s.reducer;
