"use client";

import { LifeBuoy } from "lucide-react";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ q: `profile.faq${n}Q`, a: `profile.faq${n}A` }));

/** Help — honest FAQ + a human-sounding path to support. */
export function HelpScreen() {
  const push = useAppStore((s) => s.push);

  return (
    <ScreenScaffold title={t("profile.help")}>
      <div className="space-y-6 pt-1">
        <section aria-label={t("profile.faqTitle")}>
          <SectionHeader>{t("profile.faqTitle")}</SectionHeader>
          <div className="overflow-hidden rounded-2xl border border-border bg-card px-4">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-hairline/70 last:border-0">
                  <AccordionTrigger className="min-h-13 py-3 text-left text-[14px] font-medium hover:no-underline">
                    {t(f.q)}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[13px] leading-[1.7] text-muted-foreground">
                    {t(f.a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section aria-label={t("profile.contactSupport")}>
          <div className="tara-paper rounded-2xl border border-border bg-card p-5 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <LifeBuoy className="h-5.5 w-5.5" strokeWidth={1.75} />
            </span>
            <h2 className="mt-3 font-display text-[17px] font-semibold leading-snug">
              {t("profile.supportNew")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {t("profile.supportTrustNote")}
            </p>
            <Button
              onClick={() => push({ id: "profile.support" })}
              className="press mt-4 h-11 rounded-full px-6 text-[13.5px] font-semibold"
              aria-label={t("profile.contactSupport")}
            >
              {t("profile.contactSupport")}
            </Button>
          </div>
        </section>
      </div>
    </ScreenScaffold>
  );
}

export default HelpScreen;
