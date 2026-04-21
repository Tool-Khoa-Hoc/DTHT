import { supabase } from '../lib/supabase';

export async function reconcileVipPayment(orderId) {
  if (!orderId) {
    return {
      ok: false,
      status: 'invalid_order',
      message: 'Missing order id',
    };
  }

  const { data, error } = await supabase.rpc('reconcile_vip_payment', {
    p_order_id: orderId,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== 'object') {
    return {
      ok: false,
      status: 'unknown',
      message: 'No response from reconcile_vip_payment',
    };
  }

  return data;
}
