"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth";
import { useRefreshMe } from "@/hooks/useSession";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { TrustNote } from "@/components/shared/TrustNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DELETED_ITEMS = [
  { key: "profile.deleteItemAccount" },
  { key: "profile.deleteItemProfiles" },
  { key: "profile.deleteItemChats" },
  { key: "profile.deleteItemReports" },
  { key: "profile.deleteItemWallet" },
];

/** Delete account — serious but calm. Two steps: understand, then type DELETE. */
export function DeleteAccountScreen() {
  const refreshMe = useRefreshMe();
  const resetTab = useAppStore((s) => s.resetTab);
  const pop = useAppStore((s) => s.pop);
  const [confirmed, setConfirmed] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = useMutation({
    mutationFn: () => authService.deleteAccount(),
    onSuccess: async () => {
      await refreshMe();
      resetTab("home");
    },
    onError: (err) => {
      setTyped("");
      toast.error(errorMessage(err));
    },
  });

  return (
    <ScreenScaffold title={t("profile.deleteAccount")}>
      <div className="space-y-6 pt-1">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-label={t("profile.deleteAccountTitle")}
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h1 className="font-display text-[17px] font-semibold leading-snug">
              {t("profile.deleteAccountTitle")}
            </h1>
          </div>
          <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground">
            {t("profile.deleteAccountBody")}
          </p>
        </motion.section>

        <section aria-label={t("profile.deleteWhatTitle")}>
          <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("profile.deleteWhatTitle")}
          </h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-hairline/70">
            {DELETED_ITEMS.map((item) => (
              <div key={item.key} className="flex min-h-12 items-center gap-3 px-4 py-3">
                <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <p className="text-[13.5px] leading-snug">{t(item.key)}</p>
              </div>
            ))}
          </div>
        </section>

        <TrustNote variant="pricing">{t("profile.deleteMoneyNote")}</TrustNote>

        {confirmed ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            aria-label={t("profile.deleteTypePrompt")}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <label htmlFor="delete-confirm" className="block text-[13.5px] font-medium">
              {t("profile.deleteTypePrompt")}
            </label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder={t("profile.deleteTypePlaceholder")}
              className="mt-2.5 h-12 rounded-2xl font-mono text-[15px] tracking-[0.2em]"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="mt-4 space-y-2.5">
              <Button
                onClick={() => remove.mutate()}
                disabled={typed !== "DELETE" || remove.isPending}
                variant="destructive"
                size="lg"
                className="h-13 w-full rounded-full text-[15px] font-semibold press"
              >
                {remove.isPending ? t("profile.deleting") : t("profile.deleteAccountFinal")}
              </Button>
              <Button
                onClick={() => {
                  setConfirmed(false);
                  setTyped("");
                }}
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-full text-[14px] font-semibold press"
              >
                {t("profile.deleteAccountCancel")}
              </Button>
            </div>
          </motion.section>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-13 w-full rounded-full text-[15px] font-semibold press"
                >
                  {t("profile.deleteContinue")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[360px] rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display">{t("profile.deleteAccountTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("profile.deleteAccountBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-full">{t("profile.deleteAccountCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => setConfirmed(true)}
                    className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 press"
                  >
                    {t("profile.deleteContinue")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={pop}
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-full text-[14px] font-semibold press"
            >
              {t("profile.deleteAccountCancel")}
            </Button>
          </>
        )}
      </div>
    </ScreenScaffold>
  );
}

export default DeleteAccountScreen;
