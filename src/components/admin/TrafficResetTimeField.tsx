import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { TextField } from "@/components/admin/ui";
import {
  applyTrafficResetTimeDigit,
  moveTrafficResetTimeSegment,
  timeSegmentAtCursor,
  timeSegmentRange,
  type TimeSegment,
  type TypedCount,
} from "@/utils/trafficResetTimeInput";
import { normalizeTrafficResetTime } from "@/utils/trafficResetTimezones";

export default function TrafficResetTimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const typedCountRef = useRef<TypedCount>(0);
  const [segment, setSegment] = useState<TimeSegment>(0);
  const display = normalizeTrafficResetTime(value);
  const displayRef = useRef(display);
  const segmentRef = useRef(segment);
  displayRef.current = display;
  segmentRef.current = segment;

  const selectSegment = (next: TimeSegment) => {
    segmentRef.current = next;
    setSegment(next);
    const { start, end } = timeSegmentRange(next);
    const input = inputRef.current;
    if (!input) return;
    window.requestAnimationFrame(() => {
      input.setSelectionRange(start, end);
    });
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement !== input) return;
    const { start, end } = timeSegmentRange(segment);
    input.setSelectionRange(start, end);
  }, [display, segment]);

  const commit = (next: string, nextSegment: TimeSegment, typedCount: TypedCount) => {
    typedCountRef.current = typedCount;
    displayRef.current = next;
    segmentRef.current = nextSegment;
    onChange(next);
    selectSegment(nextSegment);
  };

  const applyDigits = (digits: string) => {
    let currentValue = displayRef.current;
    let currentSegment = segmentRef.current;
    let typedCount = typedCountRef.current;
    let applied = false;
    for (const ch of digits) {
      if (ch < "0" || ch > "9") continue;
      const next = applyTrafficResetTimeDigit(currentValue, currentSegment, typedCount, Number(ch));
      currentValue = next.value;
      currentSegment = next.segment;
      typedCount = next.typedCount;
      applied = true;
    }
    if (applied) commit(currentValue, currentSegment, typedCount);
  };
  const applyDigitsRef = useRef(applyDigits);
  applyDigitsRef.current = applyDigits;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBeforeInput = (event: Event) => {
      const data = (event as InputEvent).data;
      if (!data || !/\d/.test(data)) return;
      event.preventDefault();
      applyDigitsRef.current(data);
    };
    input.addEventListener("beforeinput", onBeforeInput);
    return () => input.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  return (
    <TextField.Root
      ref={inputRef}
      aria-label={ariaLabel}
      autoComplete="off"
      inputMode="numeric"
      placeholder="00:00:00"
      spellCheck={false}
      value={display}
      onChange={(event) => {
        const next = normalizeTrafficResetTime(event.target.value);
        displayRef.current = next;
        typedCountRef.current = 0;
        onChange(next);
      }}
      onFocus={() => {
        typedCountRef.current = 0;
        selectSegment(0);
      }}
      onMouseUp={(event: MouseEvent<HTMLInputElement>) => {
        typedCountRef.current = 0;
        selectSegment(timeSegmentAtCursor(event.currentTarget.selectionStart ?? 0));
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "Tab") return;
        if (event.key >= "0" && event.key <= "9") {
          event.preventDefault();
          applyDigits(event.key);
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "Backspace") {
          event.preventDefault();
          typedCountRef.current = 0;
          selectSegment(moveTrafficResetTimeSegment(segmentRef.current, -1));
          return;
        }
        if (event.key === "ArrowRight" || event.key === ":" || event.key === ";") {
          event.preventDefault();
          typedCountRef.current = 0;
          selectSegment(moveTrafficResetTimeSegment(segmentRef.current, 1));
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === " ") {
          event.preventDefault();
        }
      }}
      onBlur={() => {
        typedCountRef.current = 0;
        onChange(normalizeTrafficResetTime(displayRef.current));
      }}
    />
  );
}
