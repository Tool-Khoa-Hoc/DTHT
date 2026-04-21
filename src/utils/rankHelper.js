export const RANK_TIERS = [
    { name: 'Tân Binh', min: 0, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: 'local_library' },
    { name: 'Thiếu Hiệp', min: 3, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-500/30', icon: 'swords' },
    { name: 'Đại Hiệp', min: 10, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-500/40', icon: 'shield' },
    { name: 'Trưởng Lão', min: 20, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-500/40', icon: 'auto_awesome' },
    { name: 'Chưởng Môn', min: 35, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300 dark:border-indigo-500/40', icon: 'account_balance' },
    { name: 'Phó Bang Chủ', min: 50, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-500/40', icon: 'military_tech' },
    { name: 'Bang Chủ', min: 50, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/20', border: 'border-amber-400', icon: 'workspace_premium', requiresApproval: true }
];

export const getUserRank = (completedCount, role, isApprovedBangChu) => {
    // Admin is now 'Thống Soái'
    if (role === 'admin') {
        return {
            name: 'Thống Soái',
            min: 0,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/20',
            border: 'border-red-500',
            icon: 'local_fire_department',
            isMax: true
        };
    }

    // Collaborators get 'Truyền Đạo Sư'
    if (role === 'collaborator' || role === 'editor') {
        return {
            name: 'Truyền Đạo Sư',
            min: 0,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            border: 'border-emerald-300 dark:border-emerald-500/40',
            icon: 'menu_book',
            isMax: true
        };
    }

    let currentRank = RANK_TIERS[0];
    let nextRank = null;

    for (let i = 0; i < RANK_TIERS.length; i++) {
        const rank = RANK_TIERS[i];
        if (completedCount >= rank.min) {
            // If it requires approval and user doesn't have it, don't assign it (stop at Phó Bang Chủ)
            if (rank.requiresApproval && !isApprovedBangChu) {
                // Keep currentRank as previous (Phó Bang Chủ), and set nextRank to Bang Chủ explicitly
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
        progress: nextRank ? {
            current: completedCount,
            target: nextRank.min,
            remaining: Math.max(0, nextRank.min - completedCount),
            percentage: Math.min(100, Math.round((completedCount / nextRank.min) * 100)),
            pendingApproval: nextRank.requiresApproval && completedCount >= nextRank.min && !isApprovedBangChu
        } : null
    };
};
