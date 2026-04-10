/**
 * useExamAccess.js
 * Logic kiểm soát quyền truy cập đề thi.
 * 
 * ✅ Bảo mật: Toàn bộ logic thời gian (VIP expiry, giới hạn ngày) chạy server-side.
 * Tuyệt đối không tự tính new Date() hay todayStart ở client nữa.
 * 
 * Hook này chỉ làm đúng 1 việc: gọi RPC check_and_log_exam_access và cache kết quả.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Cache trong session (1 giờ) để tránh gọi lại DB khi user navigate qua lại
const CACHE_TTL_MS = 3_600_000;

/**
 * @param {string} examId  - ID của đề thi
 * @returns {{ loading: boolean, allowed: boolean, isRevisit: boolean, reason: string|null }}
 */
export function useExamAccess(examId) {
  const { user } = useAuth();
  const cacheKey = `access_cache_${examId}_${user?.id}`;

  // Đọc cache một lần khi khởi tạo
  const getCache = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < CACHE_TTL_MS) return parsed;
    } catch (_) {}
    return null;
  }, [cacheKey]);

  const cached = getCache();

  const [loading,   setLoading]   = useState(!cached);
  const [allowed,   setAllowed]   = useState(cached?.allowed   ?? false);
  const [isRevisit, setIsRevisit] = useState(cached?.isRevisit ?? false);
  const [reason,    setReason]    = useState(cached?.reason    ?? null);

  const setCache = useCallback((data) => {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ...data, ts: Date.now() }));
    } catch (_) {}
  }, [cacheKey]);

  useEffect(() => {
    if (!examId || !user) {
      // Chưa đăng nhập hoặc chưa có examId → chặn ngay, không gọi DB
      setAllowed(false);
      setReason(user ? null : 'not_logged_in');
      setLoading(false);
      return;
    }

    // Còn trong TTL cache → dùng luôn, không gọi DB
    const hit = getCache();
    if (hit) {
      setAllowed(hit.allowed);
      setIsRevisit(hit.isRevisit);
      setReason(hit.reason);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // ← 1 lần gọi duy nhất. Mọi logic thời gian chạy ở PostgreSQL server.
        const { data, error } = await supabase.rpc('check_and_log_exam_access', {
          p_user_id: user.id,
          p_exam_id: examId,
        });

        if (cancelled) return;

        if (error) {
          console.error('[useExamAccess] RPC error:', error.message);
          setAllowed(false);
          setReason('error');
          return;
        }

        const result = {
          allowed:   Boolean(data?.allowed),
          isRevisit: Boolean(data?.isRevisit),
          reason:    data?.reason ?? null,
        };

        setCache(result);
        setAllowed(result.allowed);
        setIsRevisit(result.isRevisit);
        setReason(result.reason);

      } catch (err) {
        if (!cancelled) {
          console.error('[useExamAccess] Unexpected error:', err);
          setAllowed(false);
          setReason('error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [examId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, allowed, isRevisit, reason };
}
