/**
 * Identidade estável das linhas do pedido (Order.items[].line_id).
 *
 * Gerada apenas quando o item é criado e nunca regenerada ao editar o pedido:
 * a identidade não depende da posição do item no array.
 */

export function newOrderLineId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Preserva o line_id existente e gera apenas nos itens que ainda não têm. */
export function withLineIds(items = []) {
  return (items || []).map(item => (item && item.line_id ? item : { ...item, line_id: newOrderLineId() }));
}