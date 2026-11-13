/** Regras puras para remoção em massa de linhas dos pedidos reais. */
export function orderDateInLocalTimezone(order, timeZone = 'America/Porto_Velho') {
  const date = new Date(order?.created_date);
  if (Number.isNaN(date.getTime())) return String(order?.created_date || '').slice(0, 10);
  return date.toLocaleDateString('en-CA', { timeZone });
}

export function orderItemIdentity(item) {
  if (item?.product_id) return `id:${item.product_id}`;
  return `name:${String(item?.product_name || '').trim().toLocaleLowerCase('pt-BR')}`;
}

export function removeProductFromOrder(order, productKey) {
  const items = (order?.items || []).filter(item => orderItemIdentity(item) !== productKey);
  const subtotal = items.reduce((sum, item) =>
    item.is_bonus ? sum : sum + (Number(item.final_unit_price ?? item.unit_price) || 0) * (Number(item.quantity) || 0), 0);
  const discountType = order?.discount_type;
  const discountValue = Number(order?.discount_value) || 0;
  const discountAmount = discountValue > 0
    ? discountType === 'percent'
      ? subtotal * (discountValue / 100)
      : discountType === 'value' ? Math.min(discountValue, subtotal) : 0
    : 0;
  return {
    items,
    subtotal,
    discount_type: discountAmount > 0 ? discountType : null,
    discount_value: discountAmount > 0 ? discountValue : 0,
    discount_amount: discountAmount,
    total: Math.max(0, subtotal - discountAmount),
  };
}

export function isOrderEligibleForBulkItemRemoval(order) {
  return !['Entregue', 'Cancelado'].includes(order?.status);
}
