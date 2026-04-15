import { base44 } from '@/api/base44Client';

export async function generateOrderNumber() {
  try {
    // Fetch top 5 to reduce race condition window (pick the highest number seen)
    const orders = await base44.entities.Order.list('-order_number', 5);
    const maxNumber = orders.reduce((max, o) => Math.max(max, o.order_number || 0), 0);
    // Add a small random jitter (0–9) to reduce collision probability under concurrency
    return maxNumber + 1 + Math.floor(Math.random() * 10);
  } catch (e) {
    // Fallback: timestamp-based unique number
    return Math.floor(Date.now() / 1000) % 9000000 + 1000000;
  }
}