-- Recompute all historical exam_results against normalized answer keys.
-- This repairs rows that were previously scored with mismatched key formats.

WITH normalized_keys AS (
    SELECT
        ek.exam_id,
        public.normalize_exam_answer_payload(ek.answer_key) AS answer_key
    FROM public.exam_keys ek
    WHERE ek.answer_key IS NOT NULL
      AND jsonb_typeof(ek.answer_key) = 'object'
      AND ek.answer_key <> '{}'::jsonb
),
rescored AS (
    SELECT
        r.id,
        s.correct_count,
        s.total_questions,
        s.score
    FROM public.exam_results r
    JOIN normalized_keys k
      ON lower(r.exam_id) = lower(k.exam_id)
    CROSS JOIN LATERAL public.calculate_exam_score(
        k.answer_key,
        COALESCE(r.answers_snapshot, '{}'::jsonb),
        r.subject_folder
    ) s
)
UPDATE public.exam_results r
SET
    score = rescored.score,
    correct_count = rescored.correct_count,
    total_questions = rescored.total_questions,
    is_scored = true,
    scored_at = now()
FROM rescored
WHERE r.id = rescored.id;
