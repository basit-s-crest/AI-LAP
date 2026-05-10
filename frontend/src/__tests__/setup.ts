/**
 * Global test setup.
 * Configures TanStack Query's notifyManager to batch updates inside React's
 * act() so that state updates are flushed synchronously in tests and the
 * "not wrapped in act()" warning is suppressed.
 */
import { act } from "@testing-library/react";
import { notifyManager } from "@tanstack/react-query";

notifyManager.setScheduler((cb) => {
  act(cb);
});
