import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('seed covers first-class analysis modes', () => {
  it('defines chatgpt, gemini, ai_mode and ai_overview in model matrix', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/seed-dev.mjs'), 'utf8');
    expect(source).toContain("analysisMode: 'chatgpt'");
    expect(source).toContain("analysisMode: 'gemini'");
    expect(source).toContain("analysisMode: 'ai_mode'");
    expect(source).toContain("analysisMode: 'ai_overview'");
  });
});
