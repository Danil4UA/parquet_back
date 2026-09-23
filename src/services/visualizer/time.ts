/** Shop calendar helpers. "Today" for limits and statistics is the shop's day (Asia/Jerusalem), not the server's. */

const TZ = "Asia/Jerusalem";

/** Start of the current calendar day in the shop's timezone, as a UTC Date. */
export const startOfTodayInShopTz = (now = new Date()): Date => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Same wall-clock date/time in UTC, then shift by the elapsed time since midnight.
  const wallClockAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const sinceMidnight = wallClockAsUtc - Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(now.getTime() - sinceMidnight - (now.getTime() % 1000));
};
