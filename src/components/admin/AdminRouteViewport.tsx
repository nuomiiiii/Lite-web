import React from "react";
import { useLocation } from "react-router-dom";
import {
  getAdminRouteViewKey,
  isAdminRouteViewReady,
  promoteAdminRouteView,
  stageAdminRouteView,
  type RouteViewportState,
} from "@/utils/adminRouteViewport";

const isRouteViewReady = (element: HTMLElement) =>
  isAdminRouteViewReady({
    hasPendingMarker:
      element.querySelector('[data-admin-route-pending="true"]') !== null,
    childElementCount: element.childElementCount,
    textContent: element.textContent,
  });

const AdminRouteViewport = ({
  fallback,
  outlet,
}: {
  fallback: React.ReactNode;
  outlet: React.ReactNode;
}) => {
  const location = useLocation();
  const incomingKey = getAdminRouteViewKey(location);
  const viewElements = React.useRef(new Map<string, HTMLDivElement>());
  const [showProgress, setShowProgress] = React.useState(false);
  const [state, setState] = React.useState<RouteViewportState<React.ReactNode>>(() => ({
    activeKey: incomingKey,
    pendingKey: null,
    views: [{ key: incomingKey, outlet }],
  }));

  React.useLayoutEffect(() => {
    setState((current) => stageAdminRouteView(current, incomingKey, outlet));
  }, [incomingKey, outlet]);

  React.useEffect(() => {
    if (!state.pendingKey) {
      setShowProgress(false);
      return;
    }
    const timer = window.setTimeout(() => setShowProgress(true), 180);
    return () => window.clearTimeout(timer);
  }, [state.pendingKey]);

  React.useLayoutEffect(() => {
    const pendingKey = state.pendingKey;
    if (!pendingKey) return;
    const element = viewElements.current.get(pendingKey);
    if (!element) return;

    let animationFrame = 0;
    let readyFrames = 0;
    let stopped = false;
    const promote = () => {
      setState((current) => promoteAdminRouteView(current, pendingKey));
    };
    const check = () => {
      if (stopped) return;
      if (!isRouteViewReady(element)) {
        readyFrames = 0;
        return;
      }
      readyFrames += 1;
      if (readyFrames >= 2) {
        promote();
        return;
      }
      animationFrame = window.requestAnimationFrame(check);
    };
    const observer = new MutationObserver(() => {
      readyFrames = 0;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(check);
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-admin-route-pending"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    animationFrame = window.requestAnimationFrame(check);

    return () => {
      stopped = true;
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [state.pendingKey]);

  return (
    <div className="admin-route-viewport">
      {showProgress && state.pendingKey ? (
        <div
          aria-label="页面载入中"
          className="admin-route-progress-track"
          role="status"
        >
          <span className="admin-route-progress-indicator" />
        </div>
      ) : null}
      {state.views.map((view) => {
        const active = view.key === state.activeKey;
        return (
          <div
            key={view.key}
            ref={(element) => {
              if (element) viewElements.current.set(view.key, element);
              else viewElements.current.delete(view.key);
            }}
            aria-hidden={active ? undefined : true}
            className="admin-route-view"
            data-admin-route-active={active ? "true" : "false"}
            inert={active ? undefined : true}
          >
            <React.Suspense fallback={fallback}>{view.outlet}</React.Suspense>
          </div>
        );
      })}
    </div>
  );
};

export default AdminRouteViewport;
