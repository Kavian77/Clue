import { vi } from "vitest";

// Mock window methods that aren't in happy-dom
Object.defineProperty(window, "clearTimeout", {
  value: vi.fn(),
});

Object.defineProperty(window, "setTimeout", {
  value: vi.fn(),
});

// Mock crypto.randomUUID
Object.defineProperty(window.crypto, "randomUUID", {
  value: () => "12345678-1234-1234-1234-123456789012",
});
