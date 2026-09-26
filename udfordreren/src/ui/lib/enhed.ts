// Små tjek af enheden (installeret app, touch). Ingen React og ingen sideeffekter.

/** Kører spillet som installeret app (hjemmeskærm/dock)? */
export function erInstalleret(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Touch-enhed med grov pegeenhed (iPhone, iPad, Android) */
export function erTouch(): boolean {
  try {
    return !!window.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
