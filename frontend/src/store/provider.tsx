"use client";

import { useMemo } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./index";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo<AppStore>(() => makeStore(), []);
  return <Provider store={store}>{children}</Provider>;
}
