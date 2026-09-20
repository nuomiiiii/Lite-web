const BEIJING_TZ = "Asia/Shanghai";

export type CalendarDay = {
  year: number;
  month: number;
  day: number;
};

export type TrafficResetClock = {
  time?: string | null;
  timezone?: string | null;
};

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function cycleBoundary(year: number, month: number, resetDay: number): CalendarDay {
  const last = daysInMonth(year, month);
  return { year, month, day: resetDay > last ? last : resetDay };
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function parseClock(value?: string | null): { hour: number; minute: number; second: number } {
  const match = String(value || "00:00:00").trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return { hour: 0, minute: 0, second: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return { hour: 0, minute: 0, second: 0 };
  return { hour, minute, second };
}

function resolveTimezone(value?: string | null): string {
  const timezone = String(value || "").trim();
  return timezone || BEIJING_TZ;
}

function zonedNow(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function clockSeconds(hour: number, minute: number, second: number): number {
  return hour * 3600 + minute * 60 + second;
}

function isBeforeBoundary(
  local: ReturnType<typeof zonedNow>,
  boundary: CalendarDay,
  clock: { hour: number; minute: number; second: number },
): boolean {
  if (local.year !== boundary.year) return local.year < boundary.year;
  if (local.month !== boundary.month) return local.month < boundary.month;
  if (local.day !== boundary.day) return local.day < boundary.day;
  return clockSeconds(local.hour, local.minute, local.second) < clockSeconds(clock.hour, clock.minute, clock.second);
}

export function normalizeTrafficResetDay(resetDay: number | null | undefined): number | null {
  const day = Number(resetDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

export function trafficResetCycleRange(
  resetDay: number | null | undefined,
  now: Date = new Date(),
  clock: TrafficResetClock = {},
): { start: CalendarDay; next: CalendarDay } | null {
  const day = normalizeTrafficResetDay(resetDay);
  if (day == null) return null;
  const timezone = resolveTimezone(clock.timezone);
  const tod = parseClock(clock.time);
  const local = zonedNow(now, timezone);
  let start = cycleBoundary(local.year, local.month, day);
  if (isBeforeBoundary(local, start, tod)) {
    const previous = previousMonth(local.year, local.month);
    start = cycleBoundary(previous.year, previous.month, day);
  }
  const following = nextMonth(start.year, start.month);
  return { start, next: cycleBoundary(following.year, following.month, day) };
}

function formatMonthDay(value: CalendarDay, clock: { hour: number; minute: number; second: number }): string {
  const date = `${value.month}月${value.day}日`;
  if (clock.hour === 0 && clock.minute === 0 && clock.second === 0) return date;
  const time = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}:${String(clock.second).padStart(2, "0")}`;
  return `${date} ${time}`;
}

export function formatTrafficResetRangeLabel(
  resetDay: number | null | undefined,
  now: Date = new Date(),
  clock: TrafficResetClock = {},
): string | null {
  const range = trafficResetCycleRange(resetDay, now, clock);
  if (!range) return null;
  const tod = parseClock(clock.time);
  return `${formatMonthDay(range.start, tod)} - ${formatMonthDay(range.next, tod)}`;
}
