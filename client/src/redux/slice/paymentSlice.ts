import { createSlice, PayloadAction } from "@reduxjs/toolkit";
export type Provider = "stripe" | "jazzcash" | "easypaisa";
export type PaymentInput = { orderId: string; provider: Provider };
export type PaymentResult = {
  status: "pending";
  message?: string;
  url?: string;
};
const s = createSlice({
  name: "payment",
  initialState: {
    loading: false,
    result: null as PaymentResult | null,
    error: "",
  },
  reducers: {
    createRequest(x, a: PayloadAction<PaymentInput>) {
      x.loading = true;
      x.error = "";
      x.result = null;
      if (!a.payload.orderId) x.error = "Order id is required";
    },
    createSuccess(x, a: PayloadAction<PaymentResult>) {
      x.loading = false;
      x.result = a.payload;
    },
    createFailure(x, a: PayloadAction<string>) {
      x.loading = false;
      x.error = a.payload;
    },
  },
});
export const paymentActions = s.actions;
export default s.reducer;
