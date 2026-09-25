"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Database, Download, Eye, Lock, MessageSquare, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { userService } from "@/services/user";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Privacy centre — premium, plain-language, data ownership front and centre. */
export function PrivacyScreen() {
  const push = useAppStore((s) => s.push);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const data = await userService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tara-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(t("profile.dataDownloaded"));
    } catch (err) {
      toast.error(t("profile.dataDownloadFailed"), { description: errorMessage(err) });
    } finally {
      setDownloading(false);
    }
  };

  const cards = [
    { icon: ShieldCheck, titleKey: "profile.privacyWhatTitle", bodyKey: "profile.privacyWhatBody" },
    { icon: Eye, titleKey: "profile.privacyWhyTitle", bodyKey: "profile.privacyWhyBody" },
    { icon: Lock, titleKey: "profile.privacyWhoTitle", bodyKey: "profile.privacyWhoBody" },
    { icon: MessageSquare, titleKey: "profile.privacyConsultTitle", bodyKey: "profile.privacyConsultBody" },
    { icon: Trash2, titleKey: "profile.privacyDeleteTitle", bodyKey: "profile.privacyDeleteBody" },
  ];

  return (
    <ScreenScaffold title={t("profile.privacyTitle")} width="default">
      {/*
       * Mobile: single column stack. lg+: the five plain-language cards pair
       * into a calm 2-column arrangement (intro + destructive CTA stay full-width).
       */}
      <div className="space-y-5 pt-1 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:space-y-0">
        <p className="px-1 text-[14px] leading-relaxed text-muted-foreground lg:col-span-2">
          {t("common.appName")} {t("common.tagline").toLowerCase()} — your data stays yours.
        </p>

        {cards.map((c, i) => (
          <motion.section
            key={c.titleKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            aria-label={t(c.titleKey)}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl",
                  i === 4 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
                )}
              >
                <c.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </span>
              <h2 className="text-[15px] font-semibold leading-snug">{t(c.titleKey)}</h2>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground">{t(c.bodyKey)}</p>
          </motion.section>
        ))}

        {/* download */}
        <section aria-label={t("profile.downloadData")} className="tara-paper rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
              <Database className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold leading-snug">{t("profile.downloadData")}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t("profile.downloadDataNote")}</p>
            </div>
          </div>
          <Button
            onClick={download}
            disabled={downloading}
            className="press mt-3.5 h-11 w-full rounded-full text-[13.5px] font-semibold"
            aria-label={t("profile.downloadData")}
          >
            <Download className="mr-1.5 h-4 w-4" strokeWidth={2} />
            {downloading ? t("common.loading") : t("profile.downloadData")}
          </Button>
        </section>

        {/* delete */}
        <button
          type="button"
          onClick={() => push({ id: "profile.delete" })}
          className="press flex w-full items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-left lg:col-span-2"
          aria-label={t("profile.deleteAccount")}
        >
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold text-destructive">
              {t("profile.deleteAccount")}
            </span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">{t("profile.goToDelete")}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-destructive" />
        </button>
      </div>
    </ScreenScaffold>
  );
}

export default PrivacyScreen;
