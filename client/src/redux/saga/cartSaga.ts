import { tenantSlug } from "../services/tenant";
import { call, put, select, takeLatest } from "redux-saga/effects";
import type { RootState } from "../rootReducer";
import { cartActions } from "../slice/cartSlice";
import { paymentActions } from "../slice/paymentSlice";
import { createOrder } from "../services/orderService";
function* persist() {
  const lines: RootState["cart"]["lines"] = yield select((state: RootState) => state.cart.lines);
  localStorage.setItem("rs-cart:" + tenantSlug(), JSON.stringify(lines));
}
function* send(action: ReturnType<typeof cartActions.placeOrderRequest>): Generator<any, void, any> {
  try {
    const lines: RootState["cart"]["lines"] = yield select((state: RootState) => state.cart.lines);
    const order: { id: string } = yield call(createOrder, lines, action.payload);
    yield put(cartActions.placeOrderDone());
    localStorage.removeItem("rs-cart:" + tenantSlug());
    if (action.payload.provider !== "cash") yield put(paymentActions.createRequest({ orderId: order.id, provider: action.payload.provider }));
  } catch (error) {
    yield put(cartActions.placeOrderFailed(error instanceof Error ? error.message : "We could not submit your order. Please try again."));
  }
}
export function* cartSaga() {
  yield takeLatest([cartActions.addItem.type, cartActions.syncCatalogItems.type, cartActions.decrementItem.type, cartActions.removeItem.type, cartActions.clearCart.type], persist);
  yield takeLatest(cartActions.placeOrderRequest.type, send);
}

