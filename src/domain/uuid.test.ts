import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateUUID } from './uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => vi.unstubAllGlobals());

describe('generateUUID', () => {
  it('returns a valid v4 UUID and unique values', () => {
    const a = generateUUID();
    const b = generateUUID();
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });

  it('falls back to a valid UUID when crypto.randomUUID is unavailable (HTTP context)', () => {
    // Simulate a non-secure context where crypto.randomUUID is missing.
    vi.stubGlobal('crypto', { getRandomValues: undefined });
    expect(generateUUID()).toMatch(UUID_RE);
  });
});
