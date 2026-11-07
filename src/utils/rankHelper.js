// ID tài khoản duy nhất được phép giữ ngôi vị Bang Chủ tối cao
export const SOLE_BANG_CHU_ID = '4595d8aa-636f-4031-9874-2cfba73a70a1';

export const isSoleBangChuAccount = (role, userId) => {
  if (userId) {
    return String(userId) === SOLE_BANG_CHU_ID;
  }
  return role === 'admin' || role === true;
};

export const RANK_TIERS = [
  {
    key: 'initiate',
    name: 'Tân Binh',
    nameEn: 'Initiate',
    min: 0,
    color: 'text-secondary-text',
    bg: 'bg-surface-alt',
    border: 'border-border-strong',
    icon: 'local_library',
  },
  {
    key: 'young_knight',
    name: 'Thiếu Hiệp',
    nameEn: 'Young Knight',
    min: 200,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    icon: 'swords',
  },
  {
    key: 'grand_knight',
    name: 'Đại Hiệp',
    nameEn: 'Grand Knight',
    min: 1000,
    color: 'text-jade',
    bg: 'bg-jade-soft',
    border: 'border-jade-border',
    icon: 'shield',
  },
  {
    key: 'elder',
    name: 'Trưởng Lão',
    nameEn: 'Elder',
    min: 3000,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    icon: 'auto_awesome',
  },
  {
    key: 'grandmaster',
    name: 'Chưởng Môn',
    nameEn: 'Grandmaster',
    min: 6000,
    color: 'text-accent',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'account_balance',
  },
  {
    key: 'vice_guildmaster',
    name: 'Phó Bang Chủ',
    nameEn: 'Vice Master',
    min: 12000,
    color: 'text-primary',
    bg: 'bg-primary-soft',
    border: 'border-primary/40',
    icon: 'military_tech',
  },
  {
    key: 'guildmaster',
    name: 'Bang Chủ',
    nameEn: 'Guildmaster',
    min: 25000,
    color: 'text-gold-dark',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'workspace_premium',
    requiresApproval: true,
    exclusiveBangChu: true,
  },
];

export function getRankDisplayName(tier, lang = 'vi') {
  if (!tier) return '';
  return lang === 'en' ? tier.nameEn || tier.name : tier.name;
}

const EXP_EARNABLE_TIERS = RANK_TIERS.filter((tier) => !tier.exclusiveBangChu);
const BANG_CHU_TIER = RANK_TIERS[RANK_TIERS.length - 1];

/**
 * Tính mức hạng (Quân hàm / Danh hiệu) dựa trực tiếp trên tổng EXP tích lũy.
 */
export const getUserRank = (exp = 0, role, _isApprovedBangChu, userId, lang = 'vi') => {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));

  if (isSoleBangChuAccount(role, userId)) {
    return {
      ...BANG_CHU_TIER,
      displayName: getRankDisplayName(BANG_CHU_TIER, lang),
      isBangChu: true,
      isMax: true,
      nextRank: null,
      progress: null,
    };
  }

  let currentRank = EXP_EARNABLE_TIERS[0];
  let nextRank = EXP_EARNABLE_TIERS[1] || null;

  for (let i = 0; i < EXP_EARNABLE_TIERS.length; i += 1) {
    const tier = EXP_EARNABLE_TIERS[i];
    if (safeExp >= tier.min) {
      currentRank = tier;
      nextRank = EXP_EARNABLE_TIERS[i + 1] || null;
    } else {
      nextRank = tier;
      break;
    }
  }

  const localizedNext = nextRank
    ? { ...nextRank, displayName: getRankDisplayName(nextRank, lang) }
    : null;

  return {
    ...currentRank,
    displayName: getRankDisplayName(currentRank, lang),
    isBangChu: false,
    nextRank: localizedNext,
    isMax: !localizedNext,
    progress: localizedNext
      ? {
          current: safeExp,
          target: localizedNext.min,
          remaining: Math.max(0, localizedNext.min - safeExp),
          percentage:
            localizedNext.min > 0
              ? Math.min(100, Math.max(0, Math.round((safeExp / localizedNext.min) * 100)))
              : 100,
          pendingApproval: false,
        }
      : null,
  };
};
