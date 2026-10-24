import { call, put, takeLatest } from "redux-saga/effects";
import { reservationActions } from "../slice/reservationSlice";
import { createReservation } from "../services/reservationService";
function* submit(
  a: ReturnType<typeof reservationActions.submitRequest>,
): Generator<any, void, any> {
  try {
    yield call(createReservation, a.payload);
    yield put(reservationActions.submitSuccess());
  } catch (reason) {
    yield put(reservationActions.submitFailure(reason instanceof Error ? reason.message : "Reservation request failed"));
  }
}
export function* reservationSaga() {
  yield takeLatest(reservationActions.submitRequest.type, submit);
}
