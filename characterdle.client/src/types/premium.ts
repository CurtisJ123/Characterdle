export interface PremiumAccess {
  isPremium: boolean;
  planCode: string | null;
  subscriptionStatus: string | null;
  billedPriceCents: number | null;
  currencyCode: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingDiscountCode: string | null;
  adFree: boolean;
  practiceMode: boolean;
  profileCustomization: boolean;
  supporterBadge: boolean;
  fullArchiveAccess: boolean;
  archiveLookbackDays: number;
  streakProtection: boolean;
  streakSaversPerCycle: number;
  availableStreakSavers: number;
  autoUseStreakSavers: boolean;
}

export interface PremiumState {
  access: PremiumAccess;
}

export interface PremiumStateResult {
  data: PremiumState | null;
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}
