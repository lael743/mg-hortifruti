/**
 * Núcleo da sincronização Pedido → CEASA (módulo puro, sem SDK).
 *
 * Identidade da operação CEASA: order_id + line_id.
 * A posição do item no array NUNCA é usada como identidade — o índice aparece
 * apenas na leitura da chave legada "order_id:indice" durante a migração.
 *
 * Divisão de responsabilidade dos campos:
 *  - originados do pedido (product_id, product_name, quantity, client_name, date,
 *    nfe_company_name, nfe_cnpj, line_id, item_key, active) são atualizados;
 *  - operacionais da CEASA (box_id, box_name, ceasa_value, caminhao, notes)
 *    pertencem à operação e nunca são sobrescritos por este módulo.
 */

const LOCAL_TZ = 'America/Porto_Velho';

/** Gera uma identidade nova de linha. Chamada apenas quando o item é criado. */
export function newLineId() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Garante line_id em cada item do pedido.
 * - preserva o line_id existente (nunca regenera ao editar);
 * - gera identidade apenas nos itens que ainda não têm.
 * Retorna { items, changed, assigned } — `assigned` são os índices que receberam
 * identidade agora, o que identifica itens ainda sem correspondência migrada.
 */
export function assignLineIds(items = []) {
  const assigned = [];
  let changed = false;
  const next = (items || []).map((item, index) => {
    if (item && item.line_id) return item;
    changed = true;
    assigned.push(index);
    return { ...item, line_id: newLineId() };
  });
  return { items: next, changed, assigned };
}

/** Chave legada usada antes da migração (order_id:índice) — somente leitura. */
export function legacyItemKey(orderId, index) {
  return `${orderId}:${index}`;
}

/** item_key compatível com a nova identidade (order_id:line_id). */
export function itemKeyFor(orderId, lineId) {
  if (!orderId || !lineId) return null;
  return `${orderId}:${lineId}`;
}

/** Data da operação: a data do pedido no fuso da operação. */
export function orderDateOf(order) {
  const created = order?.created_date;
  if (!created) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(created);
  if (Number.isNaN(parsed.getTime())) return String(created).slice(0, 10);
  return parsed.toLocaleDateString('en-CA', { timeZone: LOCAL_TZ });
}

function clientNameOf(order) {
  return order?.nfe_company_name || order?.customer_display_name || order?.customer_name || '';
}

function originFieldsOf(order, item) {
  return {
    order_id: order.id,
    line_id: item.line_id,
    item_key: itemKeyFor(order.id, item.line_id),
    product_id: item.product_id || '',
    product_name: item.product_name || '',
    quantity: Number(item.quantity) || 0,
    client_name: clientNameOf(order),
    date: orderDateOf(order),
    nfe_company_name: order?.nfe_company_name || '',
    nfe_cnpj: order?.nfe_cnpj || '',
    active: true,
  };
}

function initialCeasaValueOf(item) {
  return item?.final_unit_price ?? item?.unit_price ?? 0;
}

// A operação canônica de uma linha é a MAIS RECENTE: é a que a Gestão CEASA
// sempre exibiu e onde o operador fez os ajustes. Duplicatas antigas ficam inativas
// (nunca são apagadas).
function newestFirst(a, b) {
  return String(b.created_date || '').localeCompare(String(a.created_date || ''));
}

/**
 * Descreve a sincronização de um pedido com as operações CEASA existentes.
 * Não escreve nada: devolve criações, atualizações e desativações.
 */
export function buildSyncPlan(order, existingOps = []) {
  const orderId = order?.id;
  const { items, changed: lineIdsChanged, assigned } = assignLineIds(order?.items || []);

  const byLine = new Map();
  const byLegacyKey = new Map();
  const duplicates = [];
  const orphans = [];
  const opList = Array.isArray(existingOps) ? existingOps : existingOps?.items || [];
  const orderOps = opList.filter(op => op.order_id === orderId).sort(newestFirst);

  orderOps.forEach(op => {
    if (op.line_id) {
      if (byLine.has(op.line_id)) duplicates.push(op);
      else byLine.set(op.line_id, op);
      return;
    }
    if (op.item_key) {
      if (byLegacyKey.has(op.item_key)) duplicates.push(op);
      else byLegacyKey.set(op.item_key, op);
      return;
    }
    orphans.push(op); // operação não atribuível a uma linha do pedido
  });

  const base = { orderId, items, lineIdsChanged, assigned, duplicates, orphans };

  // Pedido sem NF-e: as operações ativas deixam de participar da Gestão/Impressão.
  if (!order?.requires_nfe) {
    return {
      ...base,
      mode: 'disabled',
      creates: [],
      updates: [],
      deactivate: orderOps
        .filter(op => op.active !== false)
        .map(op => ({ id: op.id, active: false })),
    };
  }

  const assignedSet = new Set(assigned);
  const claimed = new Set();
  const creates = [];
  const updates = [];

  items.forEach((item, index) => {
    if (item.is_bonus) return; // bonificação não participa da Gestão CEASA
    let op = byLine.get(item.line_id) || null;
    if (!op && assignedSet.has(index)) {
      // Item sem identidade (pré-migração): adota a operação da chave legada
      op = byLegacyKey.get(legacyItemKey(orderId, index)) || null;
    }
    if (op) {
      claimed.add(op.id);
      updates.push({ id: op.id, ...originFieldsOf(order, item) });
      return;
    }
    creates.push({
      ...originFieldsOf(order, item),
      ceasa_value: initialCeasaValueOf(item),
      box_id: '',
      box_name: '',
      caminhao: '',
      notes: '',
    });
  });

  const deactivate = orderOps
    .filter(op => !orphans.includes(op) && op.active !== false && !claimed.has(op.id))
    .map(op => ({ id: op.id, active: false }));

  return { ...base, mode: 'synced', creates, updates, deactivate };
}

/**
 * Sincroniza um pedido com o CEASA usando a camada de acesso informada.
 * deps = { listOperations, updateOrderItems, createOperations, updateOperations }
 */
export async function syncCeasaFromOrder(order, deps) {
  if (!order?.id) throw new Error('Pedido inválido para sincronização CEASA.');

  const existing = await deps.listOperations(order.id);
  const plan = buildSyncPlan(order, existing);

  if (plan.lineIdsChanged) await deps.updateOrderItems(order.id, plan.items);
  if (plan.creates.length) await deps.createOperations(plan.creates);

  const patches = [...plan.updates, ...plan.deactivate];
  if (patches.length) await deps.updateOperations(patches);

  return {
    order_id: order.id,
    mode: plan.mode,
    line_ids_generated: plan.assigned.length,
    created: plan.creates.length,
    updated: plan.updates.length,
    deactivated: plan.deactivate.length,
    duplicates: plan.duplicates.length,
    orphans: plan.orphans.length,
  };
}