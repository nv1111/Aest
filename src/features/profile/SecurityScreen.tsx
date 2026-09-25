"use client";

import { KeyRound, Lock, LogOut, Smartphone, Timer, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ListGroup, ListRow } from "./ListRow";

/** Security — session facts + how we protect you, in plain language. */
export function SecurityScreen() {
  const me = useMe();
  const refreshMe = useRefreshMe();
  const resetTab = useAppStore((s) => s.resetTab);

  const phone = me.data?.user.phone;
  const masked = phone ? `+91 ${phone.slice(0, 2)}··· ···${phone.slice(-2)}` : "—";

  const logout = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: async () => {
      await refreshMe();
      resetTab("home");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const protections = [
    { icon: Smartphone, key: "profile.protectOtp" },
    { icon: Lock, key: "profile.protectCookie" },
    { icon: Timer, key: "profile.protectExpiry" },
  ];

  return (
    <ScreenScaffold title={t("profile.security")}>
      <div className="space-y-6 pt-1">
        {/* session card */}
        <section aria-label={t("profile.sessionTitle")}>
          <SectionHeader>{t("profile.sessionTitle")}</SectionHeader>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
                <KeyRound className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("profile.sessionSignedInAs")}
                </p>
                <p className="mt-0.5 font-mono text-[15px] font-medium tracking-wide">{masked}</p>
              </div>
            </div>
            <p className="mt-3.5 text-[13px] leading-relaxed text-muted-foreground">{t("profile.sessionBody")}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{t("profile.sessionExpiry")}</p>
          </div>
        </section>

        {/* protections */}
        <section aria-label={t("profile.protectTitle")}>
          <SectionHeader>{t("profile.protectTitle")}</SectionHeader>
          <ListGroup>
            {protections.map((p) => (
              <ListRow key={p.key} icon={p.icon} title={t(p.key)} />
            ))}
          </ListGroup>
        </section>

        {/* logout */}
        <section aria-label={t("profile.logout")}>
          <ListGroup>
            <ListRow
              icon={LogOut}
              title={t("profile.logout")}
              sub={t("profile.logoutBody")}
              destructive
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            />
          </ListGroup>
        </section>

        <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
          <UserCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {t("profile.privacyWhoBody")}
        </p>
      </div>
    </ScreenScaffold>
  );
}

export default SecurityScreen;
