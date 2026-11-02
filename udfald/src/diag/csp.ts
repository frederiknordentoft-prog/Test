import { setCheck } from './store';

/** Counts CSP violations. Installed first thing in main.tsx. */
export function installCspListener(): void {
  let count = 0;
  const seen: string[] = [];
  setCheck('csp', { status: 'ok', detail: '0 overtrædelser' });
  document.addEventListener('securitypolicyviolation', (e) => {
    count++;
    const line = `${e.effectiveDirective}: ${e.blockedURI || '(inline)'}`;
    if (seen.length < 8) seen.push(line);
    setCheck('csp', { status: 'fejl', detail: `${count} overtrædelse${count === 1 ? '' : 'r'}`, data: { seen } });
  });
}
