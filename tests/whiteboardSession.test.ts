import { afterEach, expect, it, vi } from "vitest";
import {
  lastWhiteboard,
  rememberWhiteboard,
} from "../web-ui/whiteboardSession";

afterEach(() => vi.unstubAllGlobals());

it("remembers the last opened board across reads and falls back for invalid or unavailable storage", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  expect(lastWhiteboard()).toBe("research-map");
  rememberWhiteboard("reading-plan");
  expect(lastWhiteboard()).toBe("reading-plan");
  rememberWhiteboard("another-board");
  expect(lastWhiteboard()).toBe("another-board");
  rememberWhiteboard("../invalid");
  expect(lastWhiteboard()).toBe("research-map");
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  });
  expect(() => rememberWhiteboard("reading-plan")).not.toThrow();
  expect(lastWhiteboard()).toBe("research-map");
});
