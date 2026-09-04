import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsPageSkeleton from "@/components/admin/SettingsPageSkeleton";
import AuthStandAlonePage, {
  authPrimaryButtonSx,
} from "@/components/admin/shell/AuthStandAlonePage";
import { useSettings } from "@/lib/api";
import {
  ALLOW_REMOTE_MANAGEMENT_SETTING_PATH,
  isAllowRemoteManagementEnabled,
  isRemoteManagementPath,
} from "@/utils/allowRemoteManagement";

type GateValue = {
  enabled: boolean;
  loading: boolean;
  ensureEnabled: () => boolean;
};

const RemoteManagementGateContext = createContext<GateValue | null>(null);

export function useOptionalRemoteManagementGate(): GateValue | null {
  return useContext(RemoteManagementGateContext);
}

export function useRemoteManagementGate(): GateValue {
  const context = useContext(RemoteManagementGateContext);
  if (!context) {
    throw new Error(
      "useRemoteManagementGate must be used within RemoteManagementGateProvider",
    );
  }
  return context;
}

function RemoteManagementRequiredCopy() {
  const { t } = useTranslation();
  return (
    <Typography sx={{ fontSize: 15, lineHeight: 1.6 }}>
      {t("settings.general.allow_remote_management_required_description")}
    </Typography>
  );
}

export function RemoteManagementRequiredPanel({
  onGoEnable,
  onDismiss,
  overlay,
}: {
  onGoEnable: () => void;
  onDismiss?: () => void;
  overlay?: boolean;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const coverAdmin = overlay ?? location.pathname.startsWith("/admin");
  return (
    <AuthStandAlonePage
      testId="remote-management-required-page"
      cardTestId="remote-management-required-card"
      overlay={coverAdmin}
      title={t("settings.general.allow_remote_management_required_title")}
      description={t("settings.general.allow_remote_management_required_description")}
    >
      <Stack spacing={1.25}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={onGoEnable}
          sx={authPrimaryButtonSx}
        >
          {t("settings.general.allow_remote_management_go_enable")}
        </Button>
        {onDismiss ? (
          <Button
            variant="text"
            fullWidth
            onClick={onDismiss}
            sx={{ minHeight: 44, color: "text.secondary", touchAction: "manipulation" }}
          >
            {t("common.cancel")}
          </Button>
        ) : null}
      </Stack>
    </AuthStandAlonePage>
  );
}

export function RemoteManagementGateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { settings, loading } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const enabled = isAllowRemoteManagementEnabled(settings);

  const ensureEnabled = useCallback(() => {
    if (loading || enabled) return true;
    setOpen(true);
    return false;
  }, [enabled, loading]);

  const value = useMemo(
    () => ({ enabled, loading, ensureEnabled }),
    [enabled, loading, ensureEnabled],
  );

  const compact = useMediaQuery("(max-width:599.95px)");
  const goEnable = useCallback(() => {
    setOpen(false);
    navigate(ALLOW_REMOTE_MANAGEMENT_SETTING_PATH);
  }, [navigate]);

  return (
    <RemoteManagementGateContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen={compact}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: compact
            ? { elevation: 0, sx: { bgcolor: "transparent", backgroundImage: "none" } }
            : undefined,
        }}
      >
        {compact ? (
          <RemoteManagementRequiredPanel
            overlay={false}
            onGoEnable={goEnable}
            onDismiss={() => setOpen(false)}
          />
        ) : (
          <>
            <DialogTitle>
              {t("settings.general.allow_remote_management_required_title")}
            </DialogTitle>
            <DialogContent>
              <RemoteManagementRequiredCopy />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="contained" onClick={goEnable}>
                {t("settings.general.allow_remote_management_go_enable")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </RemoteManagementGateContext.Provider>
  );
}

export function guardRemoteManagementNav(
  event: Pick<MouseEvent, "preventDefault">,
  path: string,
  ensureEnabled: () => boolean,
): boolean {
  if (!isRemoteManagementPath(path)) return false;
  if (ensureEnabled()) return false;
  event.preventDefault();
  return true;
}

export function RequireAllowRemoteManagement({
  children,
  loadingFallback,
}: {
  children: ReactNode;
  loadingFallback?: ReactNode;
}) {
  const { settings, loading } = useSettings();
  const navigate = useNavigate();
  if (loading) return <>{loadingFallback ?? <SettingsPageSkeleton />}</>;
  if (isAllowRemoteManagementEnabled(settings)) return <>{children}</>;
  return (
    <RemoteManagementRequiredPanel
      onGoEnable={() => navigate(ALLOW_REMOTE_MANAGEMENT_SETTING_PATH)}
    />
  );
}
