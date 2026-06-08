/** Formats a Date as "YYYY-MM-DD" using UTC. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a Date as "YYYY-MM-DDTHH:mm:ssZ" using UTC.
 * The trailing Z makes the value a valid ISO 8601 datetime with timezone,
 * suitable for use in <time dateTime> attributes.
 */
export function formatDatetime(date: Date): string {
  return date.toISOString().slice(0, 19) + 'Z';
}

/**
 * Converts an ISO 8601 datetime string (e.g. "YYYY-MM-DDTHH:mm:ssZ") to the
 * display format "YYYY-MM-DD HH:mm" used throughout the UI.
 */
export function formatDatetimeDisplay(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

/** Returns today's date as "YYYY-MM-DD" using UTC. */
export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}
