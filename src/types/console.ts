/**
 * Phase 2 — console DTOs (astrologer + admin).
 *
 * THE CONTRACT between the console API routes (/api/astrologer-console/*,
 * /api/admin/*) and the console screens. Routes must serialize exactly these
 * shapes (dates → ISO strings); screens consume them typed.
 */

// ------------------------------------------------------------------ shared

export interface ConsoleUserBrief {
  id: string;
  name: string | null;
  phone: string | null;
}

export interface ConsoleConsultationDTO {
  id: string;
  user: ConsoleUserBrief;
  mode: string; // chat | audio | video
  status: string; // requested | active | ended | cancelled
  ratePerMinute: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  totalAmount: number | null;
  summary: string | null;
  userConsentShared: boolean;
  createdAt: string;
  messageCount: number;
}

// ------------------------------------------------------- astrologer console

export interface AstrologerEarningsDTO {
  /** 80% astrologer share of lifetime settled gross (company keeps 20%). */
  total: number;
  today: number;
  pendingPayout: number;
  lifetimeConsultations: number;
}

export interface ConsoleReviewDTO {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface AstrologerDashboardDTO {
  astrologer: {
    id: string;
    displayName: string;
    slug: string;
    photoUrl: string | null;
    onlineStatus: string;
    rating: number;
    reviewCount: number;
    pricePerMinute: number;
    experienceYears: number;
    expertise: string[];
    languages: string[];
  };
  earnings: AstrologerEarningsDTO;
  stats: {
    totalConsultations: number;
    activeNow: number;
    queueCount: number;
    cancelledCount: number;
  };
  queue: ConsoleConsultationDTO[];
  active: ConsoleConsultationDTO[];
  recentEnded: ConsoleConsultationDTO[];
  reviews: ConsoleReviewDTO[];
}

/** Kundli context panel data (consent-flagged). */
export interface AstrologerContextDTO {
  consultationId: string;
  consentShared: boolean;
  user: { name: string | null };
  profile: {
    name: string;
    dateOfBirth: string;
    timeOfBirth: string | null;
    timeAccuracy: string;
    place: string;
  } | null;
  chart: {
    ascendant: string;
    moonSign: string;
    sunSign: string;
    nakshatra: string;
    nakshatraPada: number;
    planets: {
      planet: string;
      sign: string;
      house: number;
      degree: number;
      nakshatra: string;
      retrograde: boolean;
    }[];
  } | null;
  dasha: {
    mahadasha: string;
    mahadashaEnds: string;
    antardasha: string;
    antardashaEnds: string;
  } | null;
}

// --------------------------------------------------------------- admin

export interface AdminDashboardDTO {
  metrics: {
    totalUsers: number;
    newUsers7d: number;
    totalConsultations: number;
    activeConsultations: number;
    grossRevenue: number;
    walletLiability: number;
    astrologersTotal: number;
    astrologersOnline: number;
    pendingKyc: number;
    openTickets: number;
    reportsGenerated: number;
  };
  recentUsers: { id: string; name: string | null; phone: string | null; createdAt: string }[];
  recentConsultations: ConsoleConsultationDTO[];
}

export interface AdminAstrologerDTO {
  id: string;
  displayName: string;
  slug: string;
  photoUrl: string | null;
  expertise: string[];
  languages: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationCount: number;
  pricePerMinute: number;
  isVerified: boolean;
  kycStatus: string; // pending | approved | rejected | suspended
  onlineStatus: string;
  isDemo: boolean;
  operatedByConsole: boolean; // an AstrologerAccount link exists
}

export interface AdminConsultationDTO {
  id: string;
  status: string;
  mode: string;
  user: ConsoleUserBrief;
  astrologer: { id: string; displayName: string };
  ratePerMinute: number;
  durationSeconds: number | null;
  totalAmount: number | null;
  refundedAmount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  summary: string | null;
}

export interface AdminSupportTicketDTO {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string; // open | in_progress | resolved
  response: string | null;
  user: ConsoleUserBrief;
  createdAt: string;
  resolvedAt: string | null;
}
