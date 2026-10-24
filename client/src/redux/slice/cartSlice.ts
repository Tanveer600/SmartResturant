import { tenantSlug } from "../services/tenant";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Item, Line } from "../types";
export type CheckoutInput = {
  name: string;
  phone: string;
  email: string;
  type: "pickup" | "delivery" | "dine_in";
  provider: "cash" | "stripe" | "jazzcash" | "easypaisa";
};
type CartState = { lines: Line[]; sending: boolean; error: string; orderPlaced: boolean };
const loadCart = (): Line[] => {
  try { return JSON.parse(localStorage.getItem("rs-cart:" + tenantSlug()) || "[]") as Line[]; }
  catch { return []; }
};
const s = createSlice({
  name: "cart",
  initialState: { lines: loadCart(), sending: false, error: "", orderPlaced: false } as CartState,
  reducers: {
    addItem(x, a: PayloadAction<Item>) {
      const line = x.lines.find((entry) => entry.item._id === a.payload._id);
      if (line) line.quantity++;
      else x.lines.push({ item: a.payload, quantity: 1 });
      x.error = "";
    },
    syncCatalogItems(x, a: PayloadAction<Item[]>) {
      const migrated = new Map<string, Line>();
      for (const oldLine of x.lines) {
        const current = a.payload.find((item) => item._id === oldLine.item._id) ?? a.payload.find((item) => item.name === oldLine.item.name && item.price === oldLine.item.price);
        if (!current) continue;
        const existing = migrated.get(current._id);
        if (existing) existing.quantity += oldLine.quantity;
        else migrated.set(current._id, { item: current, quantity: oldLine.quantity });
      }
      x.lines = Array.from(migrated.values());
    },    decrementItem(x, a: PayloadAction<string>) {
      const line = x.lines.find((entry) => entry.item._id === a.payload);
      if (!line) return;
      if (line.quantity <= 1) x.lines = x.lines.filter((entry) => entry.item._id !== a.payload);
      else line.quantity--;
    },
    removeItem(x, a: PayloadAction<string>) { x.lines = x.lines.filter((entry) => entry.item._id !== a.payload); },
    clearCart(x) { x.lines = []; },
    placeOrderRequest(x, a: PayloadAction<CheckoutInput>) { x.sending = Boolean(a.payload.name && a.payload.phone); x.error = ""; x.orderPlaced = false; },
    placeOrderDone(x) { x.lines = []; x.sending = false; x.error = ""; x.orderPlaced = true; },
    placeOrderFailed(x, a: PayloadAction<string>) { x.sending = false; x.error = a.payload || "We could not submit your order. Please try again."; },
    resetOrderStatus(x) { x.orderPlaced = false; x.error = ""; },
  },
});
export const cartActions = s.actions;
export default s.reducer;

