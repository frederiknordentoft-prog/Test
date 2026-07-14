// Share / copy with a resilient fallback chain. Every API here can be missing
// or blocked (permissions policy, insecure context, user cancel) — none may throw.

export type ShareResult = 'shared' | 'copied' | 'unavailable';

/** Copy text to the clipboard; returns whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  // Legacy fallback: a hidden textarea + execCommand.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a plan as text. Tries the native share sheet first, then clipboard.
 * Returns what actually happened so the UI can show the right toast.
 */
export async function sharePlan(title: string, text: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      // User cancelled — not an error, and not something to fall back from.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // Any other failure: fall back to copying.
    }
  }
  return (await copyText(text)) ? 'copied' : 'unavailable';
}
