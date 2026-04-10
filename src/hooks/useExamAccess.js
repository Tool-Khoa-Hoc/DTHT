/**
 * useExamAccess.js
 * Logic kiểm soát quyền truy cập đề thi:
 * - Admin / VIP: không giới hạn
 * - User Free: tối đa 3 đề MỚI/ngày; đề đã làm trước → cho vào tự do
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const FREE_DAILY_LIMIT = 3; // Số đề mới tối đa mỗi ngày cho user Free

/**
 * @param {string} examId  - ID của đề thi (duy nhất, từ file JSON)
 * @returns {{ loading, allowed, isRevisit, reason }}
 */
export function useExamAccess(examId) {
  const { user, profile } = useAuth();
  const cacheKey = `access_cache_${examId}_${user?.id}`;
  
  const getInitialState = useCallback(() => {
      try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
              const parsed = JSON.parse(cached);
              if (Date.now() - parsed.ts < 3600000) return parsed;
          }
      } catch (e) {}
      return null;
  }, [cacheKey]);

  const initial = getInitialState();

  const [loading, setLoading] = useState(initial ? false : true);
  const [allowed, setAllowed] = useState(initial ? initial.allowed : false);
  const [isRevisit, setIsRevisit] = useState(initial ? initial.isRevisit : false);
  const [reason, setReason] = useState(initial ? initial.reason : null);

  useEffect(() => {
    if (!examId) return;
    checkAccess();
  }, [examId, user, profile]);

  const checkAccess = async () => {
    const currentCache = getInitialState();
    if (currentCache) {
      setAllowed(currentCache.allowed);
      setIsRevisit(currentCache.isRevisit);
      setReason(currentCache.reason);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Chưa đăng nhập → chặn
    if (!user) {
      setAllowed(false);
      setReason('not_logged_in');
      setLoading(false);
      return;
    }

    // VIP hoặc Admin → luôn được vào không giới hạn
    if (profile?.is_vip || profile?.role === 'admin') {
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ allowed: true, isRevisit: false, reason: null, ts: Date.now() })); } catch (e) {}
      setAllowed(true);
      setIsRevisit(false);
      setLoading(false);
      return;
    }

    try {
      // Bước 1: Kiểm tra xem đề này đã có trong access log của user chưa (đề CŨ)
      const { data: existingLog } = await supabase
        .from('user_access_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('exam_id', examId)
        .maybeSingle();

      if (existingLog) {
        // Đề cũ → cho vào tự do, không tính vào giới hạn ngày
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ allowed: true, isRevisit: true, reason: null, ts: Date.now() })); } catch (e) {}
        setAllowed(true);
        setIsRevisit(true);
        setLoading(false);
        return;
      }

      // Bước 2: Đề MỚI → đếm số đề mới đã mở hôm nay
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('user_access_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString());

      if ((count ?? 0) >= FREE_DAILY_LIMIT) {
        // Đã đạt giới hạn → chặn
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ allowed: false, isRevisit: false, reason: 'daily_limit', ts: Date.now() })); } catch (e) {}
        setAllowed(false);
        setReason('daily_limit');
        setLoading(false);
        return;
      }

      // Bước 3: Còn slot → ghi log và cho vào
      const { error: insertError } = await supabase
        .from('user_access_log')
        .insert({ user_id: user.id, exam_id: examId });

      if (insertError) {
        // Lỗi insert (hiếm gặp) → vẫn cho vào để tránh UX xấu
        console.error('[useExamAccess] Insert log error:', insertError.message);
      }

      try { sessionStorage.setItem(cacheKey, JSON.stringify({ allowed: true, isRevisit: false, reason: null, ts: Date.now() })); } catch (e) {}
      setAllowed(true);
      setIsRevisit(false);
    } catch (err) {
      console.error('[useExamAccess] Unexpected error:', err);
      setAllowed(false);
      setReason('error');
    } finally {
      setLoading(false);
    }
  };

  return { loading, allowed, isRevisit, reason };
}
