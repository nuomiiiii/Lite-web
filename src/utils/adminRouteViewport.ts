export type RouteView<Outlet = unknown> = {
  key: string;
  outlet: Outlet;
};

export type RouteViewportState<Outlet = unknown> = {
  activeKey: string;
  pendingKey: string | null;
  views: RouteView<Outlet>[];
};

export const getAdminRouteViewKey = ({
  pathname,
  search,
  hash,
}: {
  pathname: string;
  search: string;
  hash: string;
}): string => `${pathname}${search}${hash}`;

export const isAdminRouteViewReady = ({
  hasPendingMarker,
  childElementCount,
  textContent,
}: {
  hasPendingMarker: boolean;
  childElementCount: number;
  textContent: string | null;
}): boolean =>
  !hasPendingMarker &&
  (childElementCount > 0 || Boolean(textContent?.trim()));

export const stageAdminRouteView = <Outlet>(
  current: RouteViewportState<Outlet>,
  incomingKey: string,
  outlet: Outlet,
): RouteViewportState<Outlet> => {
  if (incomingKey === current.activeKey) {
    if (!current.pendingKey) return current;
    return {
      ...current,
      pendingKey: null,
      views: current.views.filter((view) => view.key === current.activeKey),
    };
  }
  if (incomingKey === current.pendingKey) return current;
  const activeView = current.views.find(
    (view) => view.key === current.activeKey,
  );
  return {
    activeKey: current.activeKey,
    pendingKey: incomingKey,
    views: [
      ...(activeView ? [activeView] : []),
      { key: incomingKey, outlet },
    ],
  };
};

export const promoteAdminRouteView = <Outlet>(
  current: RouteViewportState<Outlet>,
  pendingKey: string,
): RouteViewportState<Outlet> => {
  if (current.pendingKey !== pendingKey) return current;
  const pendingView = current.views.find((view) => view.key === pendingKey);
  if (!pendingView) return current;
  return {
    activeKey: pendingKey,
    pendingKey: null,
    views: [pendingView],
  };
};
