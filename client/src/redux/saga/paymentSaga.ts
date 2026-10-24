import { call, put, takeLatest } from "redux-saga/effects";
import { paymentActions } from "../slice/paymentSlice";
import { startPayment } from "../services/paymentService";
function* create(
  a: ReturnType<typeof paymentActions.createRequest>,
): Generator<any, void, any> {
  try {
    const result = yield call(
      startPayment,
      a.payload!.orderId,
      a.payload!.provider,
    );
    yield put(paymentActions.createSuccess(result));
    if (result.url) window.location.assign(result.url);
  } catch (e) {
    yield put(
      paymentActions.createFailure(
        e instanceof Error ? e.message : "Payment could not start",
      ),
    );
  }
}
export function* paymentSaga() {
  yield takeLatest(paymentActions.createRequest.type, create);
}
