import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Item } from "../types";
const s = createSlice({
  name: "menu",
  initialState: { items: [] as Item[], loading: false, category: "All" },
  reducers: {
    loadMenuRequest(x) {
      x.loading = true;
    },
    loadMenuSuccess(x, a: PayloadAction<Item[]>) {
      x.items = a.payload;
      x.loading = false;
    },
    loadMenuFailure(x) {
      x.loading = false;
    },
    setCategory(x, a: PayloadAction<string>) {
      x.category = a.payload;
    },
  },
});
export const menuActions = s.actions;
export default s.reducer;
