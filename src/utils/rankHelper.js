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
    min: 3,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    icon: 'swords',
  },
  {
    name: 'Đại Hiệp',
    min: 10,
    color: 'text-jade',
    bg: 'bg-jade-soft',
    border: 'border-jade-border',
    icon: 'shield',
  },
  {
    name: 'Trưởng Lão',
    min: 20,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    icon: 'auto_awesome',
  },
  {
    name: 'Chưởng Môn',
    min: 35,
    color: 'text-accent',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'account_balance',
  },
  {
    name: 'Phó Bang Chủ',
    min: 50,
    color: 'text-primary',
    bg: 'bg-primary-soft',
    border: 'border-primary/40',
    icon: 'military_tech',
  },
  {
    name: 'Bang Chủ',
    min: 50,
    color: 'text-gold-dark',
    bg: 'bg-gold-soft',
    border: 'border-gold',
    icon: 'workspace_premium',
    requiresApproval: true,
  },
];

export const getUserRank = (completedCount = 0, role, isApprovedBangChu) => {
  if (role === 'admin' || role === true) {
    return {
      name: 'Thống Soái',
      min: 0,
      color: 'text-primary',
      bg: 'bg-primary-soft',
      border: 'border-primary/45',
      icon: 'local_fire_department',
      isMax: true,
      nextRank: null,
      progress: null,
    };
  }

  if (role === 'collaborator' || role === 'editor') {
    return {
      name: 'Truyền Đạo Sư',
      min: 0,
      color: 'text-jade',
      bg: 'bg-jade-soft',
      border: 'border-jade-border',
      icon: 'menu_book',
      isMax: true,
      nextRank: null,
      progress: null,
    };
  }

  let currentRank = RANK_TIERS[0];
  let nextRank = null;

  for (let i = 0; i < RANK_TIERS.length; i += 1) {
    const rank = RANK_TIERS[i];
    if (completedCount >= rank.min) {
      if (rank.requiresApproval && !isApprovedBangChu) {
        nextRank = rank;
        break;
      }
      currentRank = rank;
      nextRank = RANK_TIERS[i + 1] || null;
    } else {
      break;
    }
  }

  return {
    ...currentRank,
    nextRank,
    isMax: !nextRank && (!currentRank.requiresApproval || isApprovedBangChu),
    progress: nextRank
      ? {
          current: completedCount,
          target: nextRank.min,
          remaining: Math.max(0, nextRank.min - completedCount),
          percentage: Math.min(100, Math.round((completedCount / nextRank.min) * 100)),
          pendingApproval:
            nextRank.requiresApproval && completedCount >= nextRank.min && !isApprovedBangChu,
        }
      : null,
  };
};
