/**
 * Remapeamento de relacionamentos na restauração do backup (módulo puro).
 *
 * A restauração recria os registros, então um pedido restaurado recebe um ID
 * novo. Contas a receber e operações CEASA que apontam para o pedido antigo
 * precisam ser reapontadas, senão nascem órfãs. O vínculo é reconstruído pelo
 * `order_number`, que é preservado no arquivo (e é o único identificador de
 * negócio estável disponível nos dois registros).
 */

/** Campos de controle que não são recriados na restauração. */
export function toRestorable(record) {
  const { id, created_date, updated_date, created_by, ...rest } = record || {};
  return rest;
}

/** Lista criada por bulkCreate/list em qualquer um dos formatos possíveis. */
export function collectionOf(result) {
  if (Array.isArray(result)) return result;
  return result?.items || result?.records || [];
}

/**
 * Mapa ID antigo → ID novo dos pedidos restaurados, casado pelo order_number.
 */
export function buildOrderIdMap(fileOrders = [], createdOrders = []) {
  const oldIdByNumber = new Map();
  (fileOrders || []).forEach((order) => {
    if (order?.id != null && order?.order_number != null) {
      oldIdByNumber.set(String(order.order_number), order.id);
    }
  });

  const map = new Map();
  (createdOrders || []).forEach((order) => {
    if (order?.order_number == null) return;
    const oldId = oldIdByNumber.get(String(order.order_number));
    if (oldId && order.id) map.set(oldId, order.id);
  });
  return map;
}

/**
 * Reaponta a referência ao pedido. Sem correspondência no mapa, a referência
 * original é mantida (o dado não é perdido nem apagado).
 * Em operações CEASA, `item_key` é reconstruída como "order_id:line_id".
 */
export function remapOrderReference(record, orderIdMap, { rebuildItemKey = false } = {}) {
  if (!record) return record;
  const orderId = orderIdMap?.get?.(record.order_id) || record.order_id;
  const next = { ...record, order_id: orderId };
  if (rebuildItemKey && orderId && record.line_id) next.item_key = `${orderId}:${record.line_id}`;
  return next;
}