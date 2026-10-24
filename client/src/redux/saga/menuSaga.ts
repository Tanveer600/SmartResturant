import { call, put, takeLatest } from "redux-saga/effects";
import { menuActions } from "../slice/menuSlice";
import { fetchMenu } from "../services/menuService";
function* load(): Generator<any, void, any> {
  try {
    const d: Awaited<ReturnType<typeof fetchMenu>> = yield call(fetchMenu);
    yield put(menuActions.loadMenuSuccess(d.items));
  } catch {
    yield put(menuActions.loadMenuFailure());
  }
}
export function* menuSaga() {
  yield takeLatest(menuActions.loadMenuRequest.type, load);
}
