import { useSearchParams } from "react-router-dom";

import {
  nextAdminTabSearchParams,
  readAdminTabRaw,
  resolveAdminTabParam,
} from "@/utils/adminTabParam";

const EMPTY_ALIASES: readonly string[] = [];

export function useAdminTabParam<T extends string>(
  tabs: readonly T[],
  fallback: T,
  options?: { param?: string; aliases?: readonly string[] },
): [T, (next: string) => void] {
  const param = options?.param ?? "tab";
  const aliases = options?.aliases ?? EMPTY_ALIASES;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveAdminTabParam(
    readAdminTabRaw(searchParams, param, aliases),
    tabs,
    fallback,
  );

  const setTab = (nextValue: string) => {
    const next = resolveAdminTabParam(nextValue, tabs, fallback);
    setSearchParams(
      (current) => {
        const currentTab = resolveAdminTabParam(
          readAdminTabRaw(current, param, aliases),
          tabs,
          fallback,
        );
        const hasAlias = aliases.some((key) => current.has(key));
        const matchesFallback =
          next === fallback ? !current.get(param) : current.get(param) === next;
        if (next === currentTab && !hasAlias && matchesFallback) return current;
        return nextAdminTabSearchParams(current, next, fallback, param, aliases);
      },
      { replace: true },
    );
  };

  return [tab, setTab];
}
