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
 *
 * REGRA CANÔNICA ÚNICA (mesma usada na leitura e na gravação):
 * a operação canônica de uma linha é a MAIS RECENTE ATIVA; se a linha não tiver
 * nenhuma ativa, a mais recente. Ver `pickCanonicalOperation` — a paridade com
 * src/lib/ceasaOperations.js#pickOperation é coberta por tests/ceasaParity.test.mjs.
 *
 * Valor CEASA: inicializado UMA única vez, com o preço efetivo comercial do item
 * (`initialCeasaValueOf`) e nunca recalculado depois (inclusive quando o
 * operador digita 0). Sem preço comercial, a operação nasce sem valor.
 */

import { pickCanonicalOperation, newestFirst } from './ceasaOperationRules.js';

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

/**
 * Preço efetivo comercial do item (por unidade).
 * Nunca usa valor fiscal (nfe_value) nem preço de catálogo do produto.
 * Espelhado em src/lib/ceasaValue.js#effectiveUnitPrice.
 */
export function effectiveUnitPrice(item) {
  const candidates = [item?.final_unit_price, item?.unit_price];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/**
 * Valor inicial da operação CEASA: o preço efetivo do item.
 * Devolve `undefined` quando o item não tem preço comercial — a operação nasce
 * sem valor ("valor não definido") em vez de gravar 0 por ausência de preço.
 * Espelhado em src/lib/ceasaValue.js#initialCeasaValueOf.
 */
export function initialCeasaValueOf(item) {
  const value = effectiveUnitPrice(item);
  return value > 0 ? value : undefined;
}

/** Criação de operação: `ceasa_value` só entra no registro quando existe valor. */
function creationFields(order, item) {
  const fields = {
    ...originFieldsOf(order, item),
    box_id: '',
    box_name: '',
    caminhao: '',
    notes: '',
  };
  const value = initialCeasaValueOf(item);
  return value === undefined ? fields : { ...fields, ceasa_value: value };
}

export { pickCanonicalOperation };

/**
 * Mescla identidades novas no estado ATUAL do pedido.
 * Só atribui line_id a itens sem identidade (casando por posição com o plano);
 * qualquer alteração concorrente (preço, quantidade, item adicionado/removido)
 * é preservada integralmente.
 */
export function mergeLineIds(currentItems = [], plannedItems = []) {
  let changed = false;
  const items = (currentItems || []).map((item, index) => {
    if (item?.line_id) return item;
    const planned = plannedItems[index];
    if (!planned?.line_id) return item;
    changed = true;
    return { ...item, line_id: planned.line_id };
  });
  return { items, changed };
}

/**
 * Descreve a sincronização de um pedido com as operações CEASA existentes.
 * Não escreve nada: devolve criações, atualizações e desativações.
 */
export function buildSyncPlan(order, existingOps = []) {
  const orderId = order?.id;
  const { items, changed: lineIdsChanged, assigned } = assignLineIds(order?.items || []);

  const lineGroups = new Map();
  const legacyGroups = new Map();
  const duplicates = [];
  const orphans = [];
  const opList = Array.isArray(existingOps) ? existingOps : existingOps?.items || [];
  const orderOps = opList.filter(op => op.order_id === orderId).sort(newestFirst);

  orderOps.forEach(op => {
    if (op.line_id) {
      if (!lineGroups.has(op.line_id)) lineGroups.set(op.line_id, []);
      lineGroups.get(op.line_id).push(op);
      return;
    }
    if (op.item_key) {
      if (!legacyGroups.has(op.item_key)) legacyGroups.set(op.item_key, []);
      legacyGroups.get(op.item_key).push(op);
      return;
    }
    orphans.push(op); // operação não atribuível a uma linha do pedido
  });

  // Canônica = mesma regra da leitura e da gravação (mais recente ativa).
  // As demais ficam registradas como duplicatas e as ativas são inativadas abaixo.
  const byLine = new Map();
  const byLegacyKey = new Map();
  const registerCanonical = (groups, target) => {
    groups.forEach((ops, key) => {
      const canonical = pickCanonicalOperation(ops);
      if (!canonical) return;
      target.set(key, canonical);
      ops.forEach(op => { if (op.id !== canonical.id) duplicates.push(op); });
    });
  };
  registerCanonical(lineGroups, byLine);
  registerCanonical(legacyGroups, byLegacyKey);

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
    creates.push(creationFields(order, item));
  });

  const deactivate = orderOps
    .filter(op => !orphans.includes(op) && op.active !== false && !claimed.has(op.id))
    .map(op => ({ id: op.id, active: false }));

  return { ...base, mode: 'synced', creates, updates, deactivate };
}

/**
 * Grava as identidades novas relendo o pedido imediatamente antes.
 * Uma única retentativa; se a gravação não passar, o ciclo segue com as
 * operações e o resultado sinaliza a falha (nada de pedido é perdido).
 */
async function writeLineIds(order, plan, deps) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fresh = deps.getOrder ? await deps.getOrder(order.id) : order;
      const { items, changed } = mergeLineIds(fresh?.items || order.items || [], plan.items);
      if (!changed) return { written: false, diverged: true };
      await deps.updateOrderItems(order.id, items);
      return { written: true, diverged: false };
    } catch (error) {
      lastError = error;
    }
  }

  return { written: false, diverged: true, error: lastError?.message || 'falha ao gravar identidades' };
}

/**
 * Sincroniza um pedido com o CEASA usando a camada de acesso informada.
 * deps = { listOperations, getOrder, updateOrderItems, createOperations, updateOperations }
 */
export async function syncCeasaFromOrder(order, deps) {
  if (!order?.id) throw new Error('Pedido inválido para sincronização CEASA.');

  const existing = await deps.listOperations(order.id);
  const plan = buildSyncPlan(order, existing);

  let orderWrite = { written: false, diverged: false };
  if (plan.lineIdsChanged) orderWrite = await writeLineIds(order, plan, deps);

  if (plan.creates.length) await deps.createOperations(plan.creates);

  const patches = [...plan.updates, ...plan.deactivate];
  if (patches.length) await deps.updateOperations(patches);

  return {
    order_id: order.id,
    mode: plan.mode,
    line_ids_generated: orderWrite.written ? plan.assigned.length : 0,
    order_items_written: orderWrite.written,
    order_items_diverged: orderWrite.diverged,
    order_items_error: orderWrite.error || null,
    created: plan.creates.length,
    updated: plan.updates.length,
    deactivated: plan.deactivate.length,
    duplicates: plan.duplicates.length,
    orphans: plan.orphans.length,
  };
}