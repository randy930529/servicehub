import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

/**
 * `render`/`rerender` are asynchronous in this Testing Library setup (React
 * renders concurrently), so every one of them is awaited — otherwise the hook
 * result is read before the render that produced it has flushed.
 */
describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns the initial value immediately", async () => {
    const { result } = await renderHook(() => useDebouncedValue("limpieza", 300));

    // No delay on first render: the initial fetch must not be held back.
    expect(result.current).toBe("limpieza");
  });

  test("holds a new value until the delay elapses", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    await rerender({ value: "ab" });
    expect(result.current).toBe("a");

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  test("restarts the timer on every change, emitting only the last value", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: "l" } },
    );

    for (const value of ["li", "lim", "limp", "limpi"]) {
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await rerender({ value });
    }

    // 800ms of typing, still nothing: each keystroke cancelled the pending one.
    expect(result.current).toBe("l");

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("limpi");
  });

  test("cancels the pending update on unmount", async () => {
    const { rerender, unmount } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    await rerender({ value: "ab" });
    unmount();

    // Would warn about updating an unmounted component if the effect cleanup
    // didn't clear the timeout.
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });
});
