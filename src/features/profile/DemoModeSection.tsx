"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleUser, Sparkles, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { demoService } from "@/services/console";
import { astrologersService } from "@/services/astrologers";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/http";
import { formatINR } from "@/lib/money";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";

/**
 * DemoModeSection — Phase 2 role-switch entry point (Profile → Demo Mode).
 *
 * Clearly DEMO-labelled. Switching persona re-renders the whole app surface
 * into the chosen console (AppShell branches on me.user.demoPersona). The
 * choice persists server-side — reload keeps you in the console; the console
 * header's exit button brings you back.
 */
export function DemoModeSection() {
  const me = useMe();
  const refreshMe = useRefreshMe();
  const [pickerOpen, setPickerOpen] = useState(false);

  const account = me.data?.astrologerAccount ?? null;
  const activePersona = me.data?.user?.demoPersona ?? null;

  const switchMutation = useMutation({
    mutationFn: (args: { persona: "user" | "astrologer" | "admin"; astrologerId?: string }) =>
      demoService.setPersona(args.persona, args.astrologerId),
    onSuccess: (_data, vars) => {
      setPickerOpen(false);
      void refreshMe();
      const who =
        vars.persona === "admin"
          ? t("console.shell.adminConsole")
          : vars.persona === "astrologer"
            ? t("console.shell.astrologerConsole")
            : "";
      toast.success(t("console.demo.switchedToConsole", { name: who }));
    },
    onError: (err) => toast.error(t("console.demo.switchFailed") + " " + errorMessage(err)),
  });

  const astrologersQuery = useQuery({
    queryKey: ["demo-astrologers"],
    queryFn: () => astrologersService.list({ limit: 50 }),
    enabled: pickerOpen,
    staleTime: 60_000,
  });

  const personas = [
    {
      id: "user" as const,
      icon: CircleUser,
      title: t("console.demo.customer"),
      desc: t("console.demo.customerDesc"),
      active: activePersona === null,
      onClick: () => undefined, // already in the customer app
    },
    {
      id: "astrologer" as const,
      icon: Sparkles,
      title: t("console.demo.astrologer"),
      desc: account
        ? `${account.displayName} · ${account.manualMode ? t("console.demo.manualNote") : t("console.demo.botNote")}`
        : t("console.demo.astrologerDesc"),
      active: activePersona === "astrologer",
      onClick: () => setPickerOpen(true),
    },
    {
      id: "admin" as const,
      icon: Users,
      title: t("console.demo.admin"),
      desc: t("console.demo.adminDesc"),
      active: activePersona === "admin",
      onClick: () => switchMutation.mutate({ persona: "admin" }),
    },
  ];

  return (
    <section aria-label={t("console.demo.title")}>
      <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("console.demo.title")}
      </h2>
      <div className="space-y-2.5 rounded-2xl border border-dashed border-primary/35 bg-accent/40 p-3">
        <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {t("console.demo.subtitle")}
        </p>
        {personas.map(({ id, icon: Icon, title, desc, active, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            disabled={active || switchMutation.isPending}
            aria-label={title}
            className={cn(
              "press flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors",
              active ? "border-primary/40" : "border-hairline hover:bg-secondary/60",
              active && "cursor-default"
            )}
          >
            <span
              className={cn(
                "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl",
                active ? "bg-accent text-primary" : "bg-secondary text-foreground/75"
              )}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{title}</span>
                {active ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-primary">
                    {t("console.demo.active")}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{desc}</span>
            </span>
          </button>
        ))}
        <p className="px-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
          {t("console.demo.note")}
        </p>
      </div>

      {/* astrologer persona picker */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[430px] rounded-t-3xl px-0">
          <SheetHeader className="px-5 pb-1">
            <SheetTitle>{t("console.demo.pickTitle")}</SheetTitle>
            <p className="text-[12px] leading-relaxed text-muted-foreground">{t("console.demo.pickDesc")}</p>
          </SheetHeader>
          <div className="scroll-thin max-h-[52dvh] overflow-y-auto px-3 pb-4 pt-2">
            {astrologersQuery.isLoading ? (
              <div className="px-2">
                <PageSkeleton variant="list" />
              </div>
            ) : astrologersQuery.isError ? (
              <ErrorState title={t("console.common.loadError")} onRetry={() => astrologersQuery.refetch()} />
            ) : (
              <ul className="space-y-1.5">
                {(astrologersQuery.data?.astrologers ?? [])
                  .filter((a) => a.kycStatus !== "suspended" && a.kycStatus !== "rejected")
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={switchMutation.isPending}
                        onClick={() => switchMutation.mutate({ persona: "astrologer", astrologerId: a.id })}
                        aria-label={t("console.demo.operateAs", { name: a.displayName })}
                        className="press flex w-full items-center gap-3 rounded-2xl border border-hairline bg-card p-3 text-left hover:bg-secondary/60"
                      >
                        {a.photoUrl ? (
                           
                          <img
                            src={a.photoUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary font-display text-[15px] font-semibold">
                            {a.displayName.slice(0, 1)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{a.displayName}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current text-primary" strokeWidth={0} aria-hidden />
                              {a.rating.toFixed(1)}
                            </span>
                            <span>·</span>
                            <span>
                              {formatINR(a.pricePerMinute)}
                              {t("console.common.perMin")}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
