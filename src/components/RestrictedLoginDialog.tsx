import AppDialogContent from "@/components/AppDialogContent";
import { useState } from "react";
import { Button, Dialog, Text, TextField } from "@radix-ui/themes";
import { LoaderCircle, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import LoginIdentityHeader from "@/components/LoginIdentityHeader";
import { submitPasswordLogin } from "@/utils/adminAuth";
import { sameOriginApiPath } from "@/utils/security";

export type RestrictedAuthStatus = {
  oauth_enabled: boolean;
  oauth_provider: string;
  password_login_enabled: boolean;
  logged_in: boolean;
  username?: string;
};

type RestrictedLoginDialogProps = {
  auth: RestrictedAuthStatus | null;
  onAuthenticated: () => Promise<void>;
  requestFailedKey?: string;
};

export default function RestrictedLoginDialog({
  auth,
  onAuthenticated,
  requestFailedKey = "login.request_failed",
}: RestrictedLoginDialogProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await submitPasswordLogin({
        username,
        password,
        twoFactorCode: twoFactor,
        refreshAccount: onAuthenticated,
      });
      if (result.ok) {
        setPassword("");
        setTwoFactor("");
        return;
      }
      if (result.requiresTwoFactor) setRequireTwoFactor(true);
      setError(result.message);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : t(requestFailedKey),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={auth !== null && !auth.logged_in}>
      <AppDialogContent
        maxWidth="420px"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <LoginIdentityHeader dialog />
        {auth?.password_login_enabled && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label className="block">
              <Text as="div" size="2" weight="medium" mb="1">
                {t("login.username")}
              </Text>
              <TextField.Root
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("login.username_placeholder")}
                autoComplete="username"
                autoFocus
                disabled={busy}
                size="3"
                className="text-[15px]"
              />
            </label>
            <label className="block">
              <Text as="div" size="2" weight="medium" mb="1">
                {t("login.password")}
              </Text>
              <TextField.Root
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.password_placeholder")}
                autoComplete="current-password"
                disabled={busy}
                size="3"
                className="text-[15px]"
              />
            </label>
            {requireTwoFactor && (
              <label className="block">
                <Text as="div" size="2" weight="bold" mb="1">
                  {t("login.two_factor")}
                </Text>
                <TextField.Root
                  value={twoFactor}
                  onChange={(event) => setTwoFactor(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={busy}
                  size="3"
                />
              </label>
            )}
            {error && (
              <Text as="div" size="2" color="red">
                {error}
              </Text>
            )}
            <Button
              type="submit"
              size="3"
              className="w-full"
              disabled={busy || !username.trim() || !password}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {busy ? t("loading") : t("login.title")}
            </Button>
          </form>
        )}
        {auth?.oauth_enabled && (
          <Button
            variant={auth.password_login_enabled ? "soft" : "solid"}
            className="mt-3 w-full"
            onClick={() => {
              window.location.assign(sameOriginApiPath("/api/oauth"));
            }}
          >
            {t("login.login_with", {
              provider: auth.oauth_provider || "OAuth",
            })}
          </Button>
        )}
      </AppDialogContent>
    </Dialog.Root>
  );
}
