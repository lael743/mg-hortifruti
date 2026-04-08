import { base44 } from '@/api/base44Client';

export async function generateOrderNumber() {
  try {
    const orders = await base44.entities.Order.list('-created_date', 1);
    const lastNumber = orders.length > 0 ? (orders[0].order_number || 0) : 0;
    return lastNumber + 1;
  } catch (e) {
    // Fallback: usar timestamp curto
    return Math.floor(Date.now() / 1000) % 1000000;
  }
}