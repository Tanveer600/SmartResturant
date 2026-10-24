import { all, fork } from "redux-saga/effects";
import { menuSaga } from "./saga/menuSaga";
import { cartSaga } from "./saga/cartSaga";
import { reservationSaga } from "./saga/reservationSaga";
import { paymentSaga } from "./saga/paymentSaga";
export function* rootSaga() {
  yield all([
    fork(menuSaga),
    fork(cartSaga),
    fork(reservationSaga),
    fork(paymentSaga),
  ]);
}
