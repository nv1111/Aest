"use client";

/**
 * Console screen registry — maps console ScreenId → component, separately
 * from the customer app's registry (components/app/screens.tsx).
 *
 * Phase 2 convention: ALL planned console screen ids are registered here with
 * placeholder implementations. Feature agents REPLACE the placeholder files
 * in src/features/astrologer-console/ and src/features/admin-console/ — they
 * must NOT edit this registry or the ids.
 */

import { lazy, Suspense } from "react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import type { ConsolePersona } from "@/store/console";

// astrologer console
const AstDashboardScreen = lazy(() => import("@/features/astrologer-console/DashboardScreen"));
const AstChatsScreen = lazy(() => import("@/features/astrologer-console/ChatsScreen"));
const AstChatScreen = lazy(() => import("@/features/astrologer-console/ChatScreen"));
const AstReviewsScreen = lazy(() => import("@/features/astrologer-console/ReviewsScreen"));

// admin console
const AdminDashboardScreen = lazy(() => import("@/features/admin-console/DashboardScreen"));
const AdminAstrologersScreen = lazy(() => import("@/features/admin-console/AstrologersScreen"));
const AdminConsultationsScreen = lazy(() => import("@/features/admin-console/ConsultationsScreen"));
const AdminSupportScreen = lazy(() => import("@/features/admin-console/SupportScreen"));

export function ConsoleScreenFor(
  persona: ConsolePersona,
  id: string,
  params: Record<string, string> | undefined
) {
  const key = params ? `${id}?${JSON.stringify(params)}` : id;

  if (persona === "astrologer") {
    switch (id) {
      case "ast.dashboard":
        return <AstDashboardScreen key={key} />;
      case "ast.chats":
        return <AstChatsScreen key={key} />;
      case "ast.chat":
        return <AstChatScreen key={key} consultationId={params?.consultationId} />;
      case "ast.reviews":
        return <AstReviewsScreen key={key} />;
      default:
        break;
    }
  }

  switch (id) {
    case "admin.dashboard":
      return <AdminDashboardScreen key={key} />;
    case "admin.astrologers":
      return <AdminAstrologersScreen key={key} />;
    case "admin.consultations":
      return <AdminConsultationsScreen key={key} />;
    case "admin.support":
      return <AdminSupportScreen key={key} />;
    default:
      break;
  }

  return (
    <div className="px-6 pt-16 text-center">
      <p className="font-display text-lg font-semibold">Console page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">This console screen doesn&apos;t exist.</p>
    </div>
  );
}

export function ConsoleScreenFallback() {
  return <PageSkeleton variant="cards" />;
}

export function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<ConsoleScreenFallback />}>{node}</Suspense>;
}
