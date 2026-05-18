export type ShareResult =
  | { ok: true; mode: 'native-share' | 'clipboard-api' | 'exec-command' }
  | { ok: false; reason: 'unsupported' | 'blocked' | 'failed'; error?: unknown };

const hasNavigator = () => typeof navigator !== 'undefined';
const hasDocument = () => typeof document !== 'undefined';

const fallbackCopyWithExecCommand = (text: string): boolean => {
  if (!hasDocument()) return false;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.top = '-1000px';
  input.style.left = '-1000px';

  document.body.appendChild(input);
  input.focus();
  input.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(input);
  }

  return copied;
};

export const safeCopyToClipboard = async (text: string): Promise<ShareResult> => {
  if (!hasNavigator()) return { ok: false, reason: 'unsupported' };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, mode: 'clipboard-api' };
    }
  } catch (error) {
    if (fallbackCopyWithExecCommand(text)) {
      return { ok: true, mode: 'exec-command' };
    }
    return { ok: false, reason: 'blocked', error };
  }

  if (fallbackCopyWithExecCommand(text)) {
    return { ok: true, mode: 'exec-command' };
  }

  return { ok: false, reason: 'unsupported' };
};

export const safeShareResource = async (title: string, text: string): Promise<ShareResult> => {
  if (!hasNavigator()) return { ok: false, reason: 'unsupported' };

  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return { ok: true, mode: 'native-share' };
    }
  } catch (error) {
    if (fallbackCopyWithExecCommand(text)) {
      return { ok: true, mode: 'exec-command' };
    }
    return { ok: false, reason: 'failed', error };
  }

  return safeCopyToClipboard(text);
};
