/*
 * Level / EXP ("Cấp độ" & "Công Lực") — a time-based progression that drives
 * both Cấp Độ (Level) and the EXP-based Quân Hàm / Danh Hiệu ladder in rankHelper.js.
 *
 * Economy (MUST stay in sync with the award_study_exp() SQL migration):
 *   - 10 EXP per verified minute of study.
 *   - Cost to go from level L to L+1 = 100 * L  EXP.
 *   - Minimum EXP required to REACH level L    = 50 * L * (L - 1).
 *
 * Inverting the cumulative curve gives a clean closed form:
 *   level = floor( (50 + sqrt(2500 + 200 * exp)) / 100 )
 */

export const EXP_PER_MINUTE = 10;
export const DAILY_STUDY_EXP_CAP = 3000; // 5h * 60min * 10 EXP
export const DAILY_STUDY_SECONDS_CAP = 18000; // 5h

/** Minimum lifetime EXP needed to have reached a given level. */
export function minExpForLevel(level) {
  const l = Math.max(1, Math.floor(level));
  return 50 * l * (l - 1);
}

/** Alias kept for compatibility */
export function getExpRequiredForNext(level) {
  const l = Math.max(1, Math.floor(level));
  return minExpForLevel(l + 1) - minExpForLevel(l);
}

/**
 * Resolve a lifetime EXP total into rich level info for the UI.
 * @param {number} exp lifetime EXP
 */
export function getLevelFromExp(exp) {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));
  const level = Math.floor((50 + Math.sqrt(2500 + 200 * safeExp)) / 100);

  const currentLevelMinExp = minExpForLevel(level);
  const nextLevelMinExp = minExpForLevel(level + 1);
  const expForThisLevel = nextLevelMinExp - currentLevelMinExp; // == 100 * level
  const expIntoLevel = safeExp - currentLevelMinExp;
  const expToNext = Math.max(0, nextLevelMinExp - safeExp);
  const progressPct =
    expForThisLevel > 0
      ? Math.min(100, Math.max(0, Math.round((expIntoLevel / expForThisLevel) * 100)))
      : 0;

  return {
    level,
    exp: safeExp,
    totalExp: safeExp,
    currentLevelMinExp,
    nextLevelMinExp,
    expForThisLevel,
    expForNext: expForThisLevel,
    expIntoLevel,
    expInLevel: expIntoLevel,
    expToNext,
    progressPct,
  };
}

/**
 * Visual accent for a level in Trung Hoa Sáng light tokens.
 */
export function getLevelAccent(level) {
  const l = Math.floor(level) || 1;
  if (l >= 50) {
    return {
      text: 'text-primary',
      ring: 'ring-primary/40',
      badge: 'bg-primary-soft text-primary border-primary/35',
      bar: 'from-primary to-accent',
    };
  }
  if (l >= 30) {
    return {
      text: 'text-accent',
      ring: 'ring-accent/45',
      badge: 'bg-gold-soft text-gold-dark border-gold/45',
      bar: 'from-accent to-gold',
    };
  }
  if (l >= 15) {
    return {
      text: 'text-jade',
      ring: 'ring-jade/40',
      badge: 'bg-jade-soft text-jade border-jade/35',
      bar: 'from-jade to-completed',
    };
  }
  if (l >= 5) {
    return {
      text: 'text-sky-700',
      ring: 'ring-sky-300',
      badge: 'bg-sky-50 text-sky-800 border-sky-300',
      bar: 'from-sky-600 to-jade',
    };
  }
  return {
    text: 'text-secondary-text',
    ring: 'ring-border-strong',
    badge: 'bg-surface-alt text-secondary-text border-border',
    bar: 'from-secondary-text to-foreground',
  };
}

/** Humanise a study-time total in seconds → e.g. "12 giờ 30 phút". */
export function formatStudyTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  if (m > 0) return `${m} phút`;
  return `${s} giây`;
}
