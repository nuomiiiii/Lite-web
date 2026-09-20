import { normalizeTrafficResetTime } from "./trafficResetTimezones.ts";

export type TimeSegment = 0 | 1 | 2;
export type TypedCount = 0 | 1;

const MAX_PART = [23, 59, 59] as const;

export function timeSegmentRange(segment: TimeSegment): { start: number; end: number } {
  const start = segment * 3;
  return { start, end: start + 2 };
}

export function timeSegmentAtCursor(cursor: number): TimeSegment {
  if (cursor <= 2) return 0;
  if (cursor <= 5) return 1;
  return 2;
}

function partsOf(value: string): [string, string, string] {
  const normalized = normalizeTrafficResetTime(value);
  const [hour, minute, second] = normalized.split(":");
  return [hour, minute, second];
}

function joinParts(parts: [string, string, string]): string {
  return `${parts[0]}:${parts[1]}:${parts[2]}`;
}

function padPart(value: number, max: number): string {
  const next = Math.min(max, Math.max(0, value));
  return String(next).padStart(2, "0");
}

export function applyTrafficResetTimeDigit(
  value: string,
  segment: TimeSegment,
  typedCount: TypedCount,
  digit: number,
): { value: string; segment: TimeSegment; typedCount: TypedCount } {
  const parts = partsOf(value);
  const max = MAX_PART[segment];
  const tensLimit = Math.floor(max / 10);

  if (typedCount === 0) {
    if (digit > tensLimit) {
      parts[segment] = padPart(digit, max);
      return {
        value: joinParts(parts),
        segment: segment < 2 ? ((segment + 1) as TimeSegment) : segment,
        typedCount: 0,
      };
    }
    parts[segment] = `0${digit}`;
    return { value: joinParts(parts), segment, typedCount: 1 };
  }

  const firstDigit = Number(parts[segment][1] || "0");
  parts[segment] = padPart(firstDigit * 10 + digit, max);
  return {
    value: joinParts(parts),
    segment: segment < 2 ? ((segment + 1) as TimeSegment) : segment,
    typedCount: 0,
  };
}

export function moveTrafficResetTimeSegment(
  segment: TimeSegment,
  delta: -1 | 1,
): TimeSegment {
  const next = segment + delta;
  if (next < 0) return 0;
  if (next > 2) return 2;
  return next as TimeSegment;
}
