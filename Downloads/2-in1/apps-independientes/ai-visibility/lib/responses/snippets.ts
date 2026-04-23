const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const WHITESPACE_RUN = /\s+/g;

export function normalizeResponseText(input: string): string {
  return input.replace(CONTROL_CHARS, ' ').replace(WHITESPACE_RUN, ' ').trim();
}

export function buildDisplaySnippet(input: string | null | undefined, maxLength = 180): string {
  if (!input) {
    return '';
  }

  const normalized = normalizeResponseText(input);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
