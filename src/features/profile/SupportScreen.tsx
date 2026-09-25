"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { supportService, type SupportCategory } from "@/services/support";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { TrustNote } from "@/components/shared/TrustNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES: { value: SupportCategory; labelKey: string }[] = [
  { value: "general", labelKey: "profile.supportCatGeneral" },
  { value: "billing", labelKey: "profile.supportCatBilling" },
  { value: "privacy", labelKey: "profile.supportCatPrivacy" },
  { value: "astrologer", labelKey: "profile.supportCatAstrologer" },
  { value: "bug", labelKey: "profile.supportCatBug" },
];

/** Support — report an issue; honest about demo reply expectations. */
export function SupportScreen() {
  const [category, setCategory] = useState<SupportCategory>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const valid = subject.trim().length >= 1 && message.trim().length >= 1;

  const send = useMutation({
    mutationFn: () => supportService.create({ category, subject: subject.trim(), message: message.trim() }),
    onSuccess: (res) => {
      setTicketRef(res.ticket.id.slice(0, 8).toUpperCase());
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reset = () => {
    setSubject("");
    setMessage("");
    setCategory("general");
    setTicketRef(null);
    send.reset();
  };

  if (ticketRef) {
    return (
      <ScreenScaffold title={t("profile.support")}>
        <div className="flex flex-col items-center px-6 pt-20 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-success/12 text-success"
          >
            <CheckCircle2 className="h-9 w-9" strokeWidth={1.75} />
          </motion.div>
          <h1 className="mt-6 font-display text-[22px] font-semibold leading-snug tracking-tight">
            {t("profile.supportSent")}
          </h1>
          <p className="mt-2 rounded-full bg-secondary px-3.5 py-1.5 font-mono text-[13px] font-medium tracking-wide text-secondary-foreground">
            {t("profile.supportTicketRef", { ref: `#${ticketRef}` })}
          </p>
          <p className="mt-3 max-w-[300px] text-[12.5px] leading-relaxed text-muted-foreground">
            {t("profile.supportDemoNote")}
          </p>
          <Button onClick={reset} variant="outline" className="press mt-7 h-11 rounded-full px-6 text-[13.5px] font-semibold">
            {t("profile.supportAnother")}
          </Button>
        </div>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={t("profile.supportNew")}>
      <div className="space-y-5 pt-1">
        <div>
          <label htmlFor="support-category" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("profile.supportCategory")}
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as SupportCategory)}>
            <SelectTrigger id="support-category" className="h-12 rounded-2xl text-[15px]" aria-label={t("profile.supportCategory")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-[14px]">
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="support-subject" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("profile.supportSubject")}
          </label>
          <Input
            id="support-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder={t("profile.supportSubjectPlaceholder")}
            className="h-12 rounded-2xl text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="support-message" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("profile.supportMessage")}
          </label>
          <Textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            placeholder={t("profile.supportMessagePlaceholder")}
            className="min-h-32 rounded-2xl text-[15px] leading-relaxed"
          />
        </div>

        <TrustNote variant="info">{t("profile.supportTrustNote")}</TrustNote>

        <div className="pt-1">
          <Button
            onClick={() => send.mutate()}
            disabled={!valid || send.isPending}
            size="lg"
            className="h-13 w-full rounded-full text-[15px] font-semibold press"
          >
            <Send className="mr-1.5 h-4 w-4" strokeWidth={2} />
            {send.isPending ? t("profile.supportSending") : t("profile.supportSend")}
          </Button>
        </div>
      </div>
    </ScreenScaffold>
  );
}

export default SupportScreen;
