/*
 * Level / EXP ("Cấp độ" & "Công Lực") — a time-based progression that runs
 * alongside the campaign-based Danh Hiệu ladder in rankHelper.js.
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

/**
 * Resolve a lifetime EXP total into rich level info for the UI.
 * @param {number} exp lifetime EXP
 * @returns {{
 *   level:number, exp:number,
 *   currentLevelMinExp:number, nextLevelMinExp:number,
 *   expForThisLevel:number, expIntoLevel:number, expToNext:number,
 *   progressPct:number
 * }}
 */
export function getLevelFromExp(exp) {
  const safeExp = Math.max(0, Math.floor(Number(exp) || 0));
  const level = Math.floor((50 + Math.sqrt(2500 + 200 * safeExp)) / 100);

  const currentLevelMinExp = minExpForLevel(level);
  const nextLevelMinExp = minExpForLevel(level + 1);
  const expForThisLevel = nextLevelMinExp - currentLevelMinExp; // == 100 * level
  const expIntoLevel = safeExp - currentLevelMinExp;
  const expToNext = Math.max(0, nextLevelMinExp - safeExp);
  const progressPct = expForThisLevel > 0
    ? Math.min(100, Math.max(0, Math.round((expIntoLevel / expForThisLevel) * 100)))
    : 0;

  return {
    level,
    exp: safeExp,
    currentLevelMinExp,
    nextLevelMinExp,
    expForThisLevel,
    expIntoLevel,
    expToNext,
    progressPct,
  };
}

/**
 * Visual accent for a level, intensifying as the number climbs. Uses only
 * the arena design tokens (jade → gold → ember → violet).
 */
export function getLevelAccent(level) {
  const l = Math.floor(level) || 1;
  if (l >= 50) return { text: 'text-violet-400', ring: 'ring-violet-500/45', bar: 'from-violet-500 to-ember-500', glow: '139,92,246' };
  if (l >= 30) return { text: 'text-ember-400', ring: 'ring-ember-500/45', bar: 'from-ember-500 to-gold-400', glow: '227,100,136' };
  if (l >= 15) return { text: 'text-gold-300', ring: 'ring-gold-400/45', bar: 'from-gold-400 to-ember-400', glow: '242,193,89' };
  if (l >= 5) return { text: 'text-jade-300', ring: 'ring-jade-400/45', bar: 'from-jade-400 to-gold-400', glow: '95,207,166' };
  return { text: 'text-slate-200', ring: 'ring-slate-400/35', bar: 'from-slate-400 to-jade-400', glow: '148,163,184' };
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
