import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { rootReducer } from "./rootReducer";
import { rootSaga } from "./rootSaga";
const saga = createSagaMiddleware();
export const store = configureStore({
  reducer: rootReducer,
  middleware: (g) => g({ serializableCheck: false }).concat(saga),
});
saga.run(rootSaga);
