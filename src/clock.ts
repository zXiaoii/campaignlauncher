// Time. The app runs on the real clock — every "today" in a generated ad-set
// name, every deadline default and the 48-hour helper read from here, so this is
// the one place to substitute a fixed date for tests.

export function now(): Date {
  return new Date()
}

export function nowIso(): string {
  return now().toISOString()
}

/** Local-time timestamp builder used by the seed. */
export function at(
  year: number,
  month: number,
  day: number,
  hour = 9,
  minute = 0,
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}
