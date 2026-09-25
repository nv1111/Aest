"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileDown, Loader2, Printer, Share2, FileText } from "lucide-react";
import { toast } from "sonner";
import { reportService, type ReportType } from "@/services/reports";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { ApiError, errorMessage } from "@/lib/http";
import { trackEvent } from "@/lib/analytics";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { Button } from "@/components/ui/button";
import { downloadReportHtml, printReportHtml } from "./report-html";

/** Report details — polls while generating, then renders readable sections. */
export function ReportDetailsScreen() {
  const screen = useCurrentScreen();
  const id = screen.params?.id ?? "";
  const replace = useAppStore((s) => s.replace);

  const query = useQuery({
    queryKey: ["report", id],
    queryFn: () => reportService.details(id),
    enabled: !!id,
    retry: false,
    refetchInterval: (q) => {
      const status = q.state.data?.report.status;
      return status === "generating" ? 1200 : false;
    },
  });

  const report = query.data?.report;
  const notFound = query.isError && query.error instanceof ApiError && query.error.status === 404;

  const regenerate = useMutation({
    mutationFn: (input: { type: ReportType; profileId?: string | null }) =>
      reportService.generate(input.type, input.profileId ?? undefined),
    onSuccess: (res) => {
      replace({ id: "reports.details", params: { id: res.report.id } });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!id) {
    return (
      <ScreenScaffold title={t("reports.title")}>
        <ErrorState title={t("reports.reportNotFound")} body={t("reports.reportNotFoundBody")} />
      </ScreenScaffold>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenScaffold title={t("reports.title")}>
        <PageSkeleton variant="cards" />
      </ScreenScaffold>
    );
  }

  if (query.isError) {
    return (
      <ScreenScaffold title={t("reports.title")}>
        <ErrorState
          icon={FileText}
          title={notFound ? t("reports.reportNotFound") : t("common.errorGeneric")}
          body={notFound ? t("reports.reportNotFoundBody") : errorMessage(query.error)}
          onRetry={notFound ? undefined : () => query.refetch()}
        />
      </ScreenScaffold>
    );
  }

  if (!report) return null;

  if (report.status === "generating") {
    return (
      <ScreenScaffold title={report.title}>
        <div className="flex flex-col items-center px-8 pt-24 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={1.75} />
          <h1 className="mt-6 font-display text-[20px] font-semibold tracking-tight">
            {t("reports.preparing")}
          </h1>
          <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground">
            {t("reports.preparingBody")}
          </p>
          <DemoDataBadge className="mt-5" />
        </div>
      </ScreenScaffold>
    );
  }

  if (report.status === "failed") {
    return (
      <ScreenScaffold title={report.title}>
        <ErrorState
          title={t("reports.failedTitle")}
          body={t("reports.failedBody")}
          onRetry={
            regenerate.isPending
              ? undefined
              : () => regenerate.mutate({ type: report.type as ReportType, profileId: report.profileId })
          }
        />
        {regenerate.isPending ? (
          <p className="px-8 text-center text-[12.5px] text-muted-foreground">{t("reports.preparing")}</p>
        ) : null}
      </ScreenScaffold>
    );
  }

  const sections = report.sections ?? [];
  const doc = {
    title: report.title,
    type: report.type,
    sections,
    profileName: report.profileName,
    createdAt: report.createdAt,
  };

  const handleDownload = () => {
    downloadReportHtml(doc);
    trackEvent("report_downloaded", { type: report.type });
    toast.success(t("reports.downloaded"));
  };

  const handlePrint = () => {
    printReportHtml(doc);
    trackEvent("report_downloaded", { type: report.type, via: "print" });
  };

  const handleShare = async () => {
    const first = sections[0];
    const text = t("reports.shareText", {
      title: report.title,
      summary: first ? first.body.split("\n")[0].slice(0, 160) : "",
    });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: report.title, text });
        return;
      }
      throw new Error("share_unavailable");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("reports.shared"));
      } catch {
        toast.error(t("common.errorGeneric"));
      }
    }
  };

  return (
    <ScreenScaffold title={report.title}>
      <article className="pt-1 md:max-w-[65ch]">
        {/* header */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="px-1"
        >
          <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">{report.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            <span>
              {t("reports.created")} {formatDateIN(report.createdAt, "long")}
            </span>
            {report.profileName ? (
              <>
                <span aria-hidden>·</span>
                <span>{t("reports.forProfile", { name: report.profileName })}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <DemoDataBadge />
          </div>
        </motion.header>

        {/* action bar */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button
            onClick={handleDownload}
            className="press h-11 rounded-2xl text-[12.5px] font-semibold"
            aria-label={t("reports.download")}
          >
            <FileDown className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            {t("reports.download")}
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="press h-11 rounded-2xl text-[12.5px] font-semibold"
            aria-label={t("reports.print")}
          >
            <Printer className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            {t("reports.print")}
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            className="press h-11 rounded-2xl text-[12.5px] font-semibold"
            aria-label={t("reports.share")}
          >
            <Share2 className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            {t("reports.share")}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">{t("reports.printNote")}</p>

        {/* sections */}
        <div className="mt-6 max-w-[65ch]">
          {sections.map((s, i) => (
            <motion.section
              key={`${i}-${s.heading}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.3 }}
              className="border-t border-hairline/70 py-5 first:border-t-0 first:pt-2"
              aria-label={s.heading}
            >
              <h2 className="font-display text-[17px] font-semibold leading-snug text-foreground">{s.heading}</h2>
              {s.body.split(/\n\n+/).map((p, j) => (
                <p key={j} className="mt-2.5 whitespace-pre-line text-[14px] leading-[1.75] text-foreground/90">
                  {p}
                </p>
              ))}
            </motion.section>
          ))}
        </div>

        <TrustNote variant="info" className="mt-6">
          {t("reports.disclaimer")}
        </TrustNote>
      </article>
    </ScreenScaffold>
  );
}

export default ReportDetailsScreen;
