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
    name: 'Tân Binh',
    min: 0,
    color: 'text-secondary-text',
    bg: 'bg-surface-alt',
    border: 'border-border-strong',
    icon: 'local_library',
  },
  {
    name: 'Thiếu Hiệp',
    min: 200,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    icon: 'swords',
  },
  {
    name: 'Đại Hiệp',
    min: 1000,
    color: 'text-jade',
    bg: 'bg-jade-soft',
    border: 'border-jade-border',
    icon: 'shield',
  },
  {
    name: 'Trưởng Lão',
    min: 3000,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    icon: 'auto_awesome',
  },
  {
    name: 'Chưởng Môn',
    min: 6000,
    color: 'text-accent',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'account_balance',
  },
  {
    name: 'Phó Bang Chủ',
    min: 12000,
    color: 'text-primary',
    bg: 'bg-primary-soft',
    border: 'border-primary/40',
    icon: 'military_tech',
  },
  {
    name: 'Bang Chủ',
    min: 25000,
    color: 'text-gold-dark',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'workspace_premium',
    requiresApproval: true,
    exclusiveBangChu: true,
  },
];

const EXP_EARNABLE_TIERS = RANK_TIERS.filter((tier) => !tier.exclusiveBangChu);
const BANG_CHU_TIER = RANK_TIERS[RANK_TIERS.length - 1];

/**
 * Tính mức hạng (Quân hàm / Danh hiệu) dựa trực tiếp trên tổng EXP tích lũy.
 * - EXP càng cao thì mức hạng càng cao (Tân Binh -> Thiếu Hiệp -> Đại Hiệp -> Trưởng Lão -> Chưởng Môn -> Phó Bang Chủ).
 * - Duy nhất 1 tài khoản tối cao (Admin / SOLE_BANG_CHU_ID) giữ ngôi vị Bang Chủ; không ai khác được phép là Bang Chủ.
 */
export const getUserRank = (exp = 0, role, _isApprovedBangChu, userId) => {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));

  if (isSoleBangChuAccount(role, userId)) {
    return {
      ...BANG_CHU_TIER,
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

  return {
    ...currentRank,
    isBangChu: false,
    nextRank,
    isMax: !nextRank,
    progress: nextRank
      ? {
          current: safeExp,
          target: nextRank.min,
          remaining: Math.max(0, nextRank.min - safeExp),
          percentage:
            nextRank.min > 0
              ? Math.min(100, Math.max(0, Math.round((safeExp / nextRank.min) * 100)))
              : 100,
          pendingApproval: false,
        }
      : null,
  };
};
