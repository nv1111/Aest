/** DTOs shared between API routes and the client. Wire-format only. */

export interface UserDTO {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  language: string;
  onboardingDone: boolean;
  /** Real account type: user | astrologer | admin. */
  role: string;
  /** Active role-switch demo view: null | "astrologer" | "admin". */
  demoPersona: string | null;
  createdAt: string;
}

/** Linked astrologer profile for the role-switch "astrologer" persona. */
export interface MeAstrologerAccountDTO {
  astrologerId: string;
  displayName: string;
  slug: string;
  photoUrl: string | null;
  onlineStatus: string;
  pricePerMinute: number;
  rating: number;
  manualMode: boolean;
}

export type TimeAccuracyDTO = "exact" | "approximate" | "unknown";

export interface BirthProfileDTO {
  id: string;
  userId: string;
  name: string;
  relation: string;
  dateOfBirth: string;
  timeOfBirth: string | null;
  timeAccuracy: TimeAccuracyDTO;
  placeName: string;
  placeCountry: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDTO {
  balance: number;
  currency: string;
}

export interface MeDTO {
  user: UserDTO;
  profiles: BirthProfileDTO[];
  primaryProfile: BirthProfileDTO | null;
  wallet: WalletDTO;
  unreadCount: number;
  astrologerAccount: MeAstrologerAccountDTO | null;
}

export interface OtpRequestDTO {
  phone: string;
  demoOtp: string;
  expiresInSeconds: number;
}

export interface AstrologerDTO {
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
  kycStatus: string;
  onlineStatus: "online" | "away" | "offline";
  availableFrom: string | null;
  about: string;
  consultationModes: string[];
}

export interface ReviewDTO {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface ConsultationDTO {
  id: string;
  astrologer: AstrologerDTO;
  mode: string;
  status: string;
  ratePerMinute: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  totalAmount: number | null;
  summary: string | null;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  consultationId: string;
  senderRole: string;
  content: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export interface WalletTransactionDTO {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  referenceId: string | null;
  balanceAfter: number | null;
  createdAt: string;
}

export interface ReportSectionDTO {
  heading: string;
  body: string;
}

export interface ReportDTO {
  id: string;
  type: string;
  title: string;
  status: string;
  sections: ReportSectionDTO[] | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AiMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  factors: { label: string; value: string }[] | null;
  followUps: string[] | null;
  createdAt: string;
}
