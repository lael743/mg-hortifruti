/**
 * Regra única da operação CEASA de uma linha de pedido.
 *
 * Identidade oficial: order_id + line_id (nunca o índice do array).
 * Leitura (Gestão CEASA, impressão e CSV) e gravação (salvar a linha, aplicar Box
 * em massa, aplicar caminhão) resolvem a operação por ESTE módulo, para que o Box
 * exibido seja sempre o mesmo registro efetivamente gravado.
 *
 * A operação canônica de uma linha é a mais recente ATIVA; se a linha só tiver
 * operações inativas, a mais recente delas (a linha segue visível, sem operação
 * participando da Gestão).
 */

export function operationKey(orderId, lineId) {
  if (!orderId || !lineId) return null;
  return `${orderId}:${lineId}`;
}

/** Normaliza a resposta do SDK: página ({ items }) ou array. */
export function toItems(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.items || [];
}

function newestFirst(operations) {
  return [...operations].sort((a, b) =>
    String(b?.created_date || '').localeCompare(String(a?.created_date || ''))
  );
}

/** Operações de uma linha, identificadas por order_id + line_id. */
export function operationsForLine(operations, orderId, lineId) {
  const key = operationKey(orderId, lineId);
  if (!key) return [];
  return toItems(operations).filter(op => operationKey(op?.order_id, op?.line_id) === key);
}

/** Operação canônica entre as operações de UMA linha. */
export function pickOperation(lineOperations) {
  const ops = newestFirst(lineOperations || []);
  if (!ops.length) return null;
  return ops.find(op => op.active !== false) || ops[0];
}

/** Índice order_id:line_id → operação canônica. Base da leitura da Gestão CEASA. */
export function indexOperationsByLine(operations) {
  const groups = new Map();
  toItems(operations).forEach(op => {
    const key = operationKey(op?.order_id, op?.line_id);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(op);
  });

  const index = {};
  groups.forEach((list, key) => {
    const picked = pickOperation(list);
    if (picked) index[key] = picked;
  });
  return index;
}

/**
 * Percorre todas as páginas de uma consulta com cursor.
 * fetchPage(cursor) devolve { items, next_cursor, has_more }.
 * Sem o percurso completo a leitura ficava truncada em uma única página e
 * operações já salvas (com Box configurado) desapareciam da Gestão.
 */
export async function fetchAllOperations(fetchPage, maxPages = 20) {
  const all = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    all.push(...toItems(result));
    if (!result || result.has_more !== true || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return all;
}