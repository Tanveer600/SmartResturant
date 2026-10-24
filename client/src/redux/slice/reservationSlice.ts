import { createSlice, PayloadAction } from "@reduxjs/toolkit";
export type ReservationInput = {
  name: string;
  phone: string;
  email?: string;
  startsAt: string;
  guestCount: number;
  floor: string;
  tableIds: string[];
};
const s = createSlice({
  name: "reservations",
  initialState: {
    loading: false,
    status: "idle" as "idle" | "success" | "error",
    error: "",
  },
  reducers: {
    submitRequest(x, a: PayloadAction<ReservationInput>) {
      x.loading = true;
      x.status = a.payload.name ? "idle" : "error";
    },
    submitSuccess(x) {
      x.loading = false;
      x.status = "success";
      x.error = "";
    },
    submitFailure(x, a: PayloadAction<string>) {
      x.loading = false;
      x.status = "error";
      x.error = a.payload;
    },
    reset(x) {
      x.loading = false;
      x.status = "idle";
      x.error = "";
    },
  },
});
export const reservationActions = s.actions;
export default s.reducer;
