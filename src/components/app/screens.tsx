"use client";

/**
 * Screen registry — the single map of ScreenId → component.
 * Feature agents: replace your placeholder component file; register new
 * screens HERE (coordinate via worklog to avoid conflicts).
 */

import { lazy, Suspense } from "react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { HomeScreen } from "@/features/home/HomeScreen";

const AskScreen = lazy(() => import("@/features/ask/AskScreen"));
const AstrologyHubScreen = lazy(() => import("@/features/astrology/AstrologyHubScreen"));
const KundliScreen = lazy(() => import("@/features/astrology/KundliScreen"));
const ChartScreen = lazy(() => import("@/features/astrology/ChartScreen"));
const PlanetsScreen = lazy(() => import("@/features/astrology/PlanetsScreen"));
const DashaScreen = lazy(() => import("@/features/astrology/DashaScreen"));
const TransitScreen = lazy(() => import("@/features/astrology/TransitScreen"));
const PanchangScreen = lazy(() => import("@/features/astrology/PanchangScreen"));
const HoroscopeScreen = lazy(() => import("@/features/astrology/HoroscopeScreen"));
const CompatibilityScreen = lazy(() => import("@/features/astrology/CompatibilityScreen"));
const CompatibilityResultScreen = lazy(() => import("@/features/astrology/CompatibilityResultScreen"));
const AstrologersScreen = lazy(() => import("@/features/astrologers/AstrologersScreen"));
const AstrologerProfileScreen = lazy(() => import("@/features/astrologers/AstrologerProfileScreen"));
const PreConsultationScreen = lazy(() => import("@/features/consultation/PreConsultationScreen"));
const ConsultationChatScreen = lazy(() => import("@/features/consultation/ConsultationChatScreen"));
const ConsultationHistoryScreen = lazy(() => import("@/features/consultation/ConsultationHistoryScreen"));
const ConsultationDetailsScreen = lazy(() => import("@/features/consultation/ConsultationDetailsScreen"));
const WalletScreen = lazy(() => import("@/features/wallet/WalletScreen"));
const RechargeScreen = lazy(() => import("@/features/wallet/RechargeScreen"));
const TransactionsScreen = lazy(() => import("@/features/wallet/TransactionsScreen"));
const PaymentResultScreen = lazy(() => import("@/features/wallet/PaymentResultScreen"));
const ReportsScreen = lazy(() => import("@/features/reports/ReportsScreen"));
const ReportDetailsScreen = lazy(() => import("@/features/reports/ReportDetailsScreen"));
const ProfileScreen = lazy(() => import("@/features/profile/ProfileScreen"));
const BirthProfilesScreen = lazy(() => import("@/features/profile/BirthProfilesScreen"));
const BirthEditScreen = lazy(() => import("@/features/profile/BirthEditScreen"));
const NotificationsSettingsScreen = lazy(() => import("@/features/profile/NotificationsScreen"));
const PrivacyScreen = lazy(() => import("@/features/profile/PrivacyScreen"));
const SecurityScreen = lazy(() => import("@/features/profile/SecurityScreen"));
const HelpScreen = lazy(() => import("@/features/profile/HelpScreen"));
const SupportScreen = lazy(() => import("@/features/profile/SupportScreen"));
const DeleteAccountScreen = lazy(() => import("@/features/profile/DeleteAccountScreen"));
const NotificationCenterScreen = lazy(() => import("@/features/notifications/NotificationCenterScreen"));

export function ScreenFor(id: string, params: Record<string, string> | undefined) {
  const key = params ? `${id}?${JSON.stringify(params)}` : id;
  switch (id) {
    case "onboarding":
      return <OnboardingFlow key={key} />;
    case "home":
      return <HomeScreen key={key} />;
    case "ask":
      return <AskScreen key={key} />;
    case "astrology.hub":
      return <AstrologyHubScreen key={key} />;
    case "astrology.kundli":
      return <KundliScreen key={key} />;
    case "astrology.chart":
      return <ChartScreen key={key} />;
    case "astrology.planets":
      return <PlanetsScreen key={key} />;
    case "astrology.dasha":
      return <DashaScreen key={key} />;
    case "astrology.transit":
      return <TransitScreen key={key} />;
    case "astrology.panchang":
      return <PanchangScreen key={key} />;
    case "astrology.horoscope":
      return <HoroscopeScreen key={key} />;
    case "astrology.compatibility":
      return <CompatibilityScreen key={key} />;
    case "astrology.compatibilityResult":
      return <CompatibilityResultScreen key={key} />;
    case "astrologers.list":
      return <AstrologersScreen key={key} />;
    case "astrologers.profile":
      return <AstrologerProfileScreen key={key} />;
    case "consultation.pre":
      return <PreConsultationScreen key={key} />;
    case "consultation.chat":
      return <ConsultationChatScreen key={key} />;
    case "consultation.history":
      return <ConsultationHistoryScreen key={key} />;
    case "consultation.details":
      return <ConsultationDetailsScreen key={key} />;
    case "wallet.home":
      return <WalletScreen key={key} />;
    case "wallet.recharge":
      return <RechargeScreen key={key} />;
    case "wallet.transactions":
      return <TransactionsScreen key={key} />;
    case "payment.result":
      return <PaymentResultScreen key={key} />;
    case "reports.list":
      return <ReportsScreen key={key} />;
    case "reports.details":
      return <ReportDetailsScreen key={key} />;
    case "profile.home":
      return <ProfileScreen key={key} />;
    case "profile.birthProfiles":
      return <BirthProfilesScreen key={key} />;
    case "profile.birthEdit":
      return <BirthEditScreen key={key} />;
    case "profile.notifications":
      return <NotificationsSettingsScreen key={key} />;
    case "profile.privacy":
      return <PrivacyScreen key={key} />;
    case "profile.security":
      return <SecurityScreen key={key} />;
    case "profile.help":
      return <HelpScreen key={key} />;
    case "profile.support":
      return <SupportScreen key={key} />;
    case "profile.delete":
      return <DeleteAccountScreen key={key} />;
    case "notifications.center":
      return <NotificationCenterScreen key={key} />;
    default:
      return (
        <div className="px-6 pt-16 text-center">
          <p className="font-display text-lg font-semibold">Page not found</p>
          <p className="mt-1 text-sm text-muted-foreground">The screen you asked for doesn&apos;t exist.</p>
        </div>
      );
  }
}

export function ScreenFallback() {
  return <PageSkeleton variant="cards" />;
}

export function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<ScreenFallback />}>{node}</Suspense>;
}
