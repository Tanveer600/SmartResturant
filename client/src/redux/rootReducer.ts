import { combineReducers } from "@reduxjs/toolkit";
import menu from "./slice/menuSlice";
import cart from "./slice/cartSlice";
import preferences from "./slice/preferencesSlice";
import reservations from "./slice/reservationSlice";
import payment from "./slice/paymentSlice";
export const rootReducer = combineReducers({
  menu,
  cart,
  preferences,
  reservations,
  payment,
});
export type RootState = ReturnType<typeof rootReducer>;
