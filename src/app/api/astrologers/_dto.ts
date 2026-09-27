import type { Astrologer as AstrologerRow } from "@prisma/client";

/**
 * Public astrologer mapper — colocated under api/astrologers (underscore
 * files are never routes). Private fields (payouts, identity docs) never
 * pass through here.
 */
export interface PublicAstrologer {
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
  onlineStatus: string;
  availableFrom: string | null;
  about: string;
  consultationModes: string[];
}

export function publicAstrologer(a: AstrologerRow): PublicAstrologer {
  return {
    id: a.id,
    displayName: a.displayName,
    slug: a.slug,
    photoUrl: a.photoUrl,
    expertise: JSON.parse(a.expertise) as string[],
    languages: JSON.parse(a.languages) as string[],
    experienceYears: a.experienceYears,
    rating: a.rating,
    reviewCount: a.reviewCount,
    consultationCount: a.consultationCount,
    pricePerMinute: a.pricePerMinute,
    isVerified: a.isVerified,
    kycStatus: a.kycStatus,
    onlineStatus: a.onlineStatus,
    availableFrom: a.availableFrom?.toISOString() ?? null,
    about: a.about,
    consultationModes: JSON.parse(a.consultationModes) as string[],
  };
}
