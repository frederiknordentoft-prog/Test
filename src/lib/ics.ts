// Per-step calendar events. RFC 5545 requires CRLF line endings; times are
// emitted in UTC (…Z) so no VTIMEZONE block is needed and each instant is
// unambiguous. Delivery degrades: native file-share → download → data URI.

import type { Milestone } from './schedule';

const pad = (n: number): string => String(n).padStart(2, '0');

function toUtcStamp(ts: number): string {
  const d = new Date(ts);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Build a single-event .ics string for one milestone (15-minute reminder). */
export function buildIcs(m: Milestone, createdAt: number): string {
  const end = m.at + 15 * 60000;
  const summary = escapeText(`${m.icon} ${m.title}`);
  const description = escapeText(m.note ? `${m.description}\n\n${m.note}` : m.description);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Surdej//Bageplan//DA',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${createdAt}-${m.id}@surdej`,
    `DTSTAMP:${toUtcStamp(createdAt)}`,
    `DTSTART:${toUtcStamp(m.at)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Add one step to the phone/computer calendar, choosing the best available path. */
export async function addToCalendar(m: Milestone, createdAt: number): Promise<void> {
  const ics = buildIcs(m, createdAt);
  const filename = `surdej-${m.id}.ics`;

  // 1) Native file share — the nicest path on iOS ("Føj til Kalender").
  try {
    const file = new File([ics], filename, { type: 'text/calendar' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: m.title });
      return;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    // otherwise fall through
  }

  // 2) Download via object URL (desktop / Android).
  try {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  } catch {
    // 3) Last resort: navigate to a data URI (legacy iOS opens the import sheet).
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }
}
