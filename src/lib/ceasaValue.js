/**
 * Regras de valor do CEASA no frontend.
 *
 * Espelhado em base44/shared/ceasaSync.js e base44/shared/ceasaAudit.js
 * (o diretório base44/ é server-side e não pode ser importado pelo cliente —
 * a paridade das duas cópias é coberta por tests/ceasaParity.test.mjs).
 */

/**
 * Preço efetivo comercial do item (por unidade).
 * Nunca usa o valor fiscal (nfe_value) nem o preço de catálogo do produto.
 * Retorna 0 quando o item não tem preço comercial calculado.
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
 * Devolve `undefined` quando o item não tem preço comercial — nesse caso a
 * operação nasce sem valor ("valor não definido") em vez de gravar 0.
 */
export function initialCeasaValueOf(item) {
  const value = effectiveUnitPrice(item);
  return value > 0 ? value : undefined;
}

/**
 * Valor CEASA exibido numa linha do relatório.
 * O valor da operação manda (inclusive quando o operador digitou 0); sem valor
 * definido, cai para o preço efetivo do item no momento da leitura.
 */
export function displayCeasaValue(operation, item) {
  if (operation && operation.ceasa_value != null) return Number(operation.ceasa_value) || 0;
  return effectiveUnitPrice(item);
}

/**
 * Valor do pedido (coluna "Valor pedido"): valor fiscal quando sobrescrito
 * (meia nota), senão o preço final do item. Nunca alimenta o CEASA.
 */
export function effectiveNfeValue(item) {
  if (item?.nfe_value != null) return item.nfe_value;
  return item?.final_unit_price ?? item?.unit_price ?? 0;
}

/**
 * Converte o texto digitado no campo "Valor CEASA" em número.
 * Aceita as três grafias da operação: "0", "0.00" e "0,00".
 * Devolve `null` apenas quando o campo está vazio ou o texto não é numérico —
 * nesse caso o valor continua "não definido". Zero digitado é valor DEFINIDO:
 * nunca é confundido com campo vazio nem com ausência de preenchimento.
 */
export function parseCeasaValueInput(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/\s/g, '');
  if (text === '') return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Operação com valor CEASA DEFINIDO como zero. Zero é valor, não ausência de
 * preenchimento: recebe apenas um destaque visual suave e nunca é recalculado.
 */
export function isCeasaValueZero(operation) {
  if (!operation || operation.ceasa_value == null) return false;
  return Number(operation.ceasa_value) === 0;
}

/**
 * Valor CEASA diferente do preço efetivo do item no pedido — referência
 * exclusivamente visual. Sem valor definido na operação, ou sem preço no pedido,
 * não há divergência a indicar (nada é recalculado).
 */
export function isCeasaValueDivergent(operation, item) {
  if (!operation || operation.ceasa_value == null) return false;
  const definido = Number(operation.ceasa_value);
  const pedido = effectiveNfeValue(item);
  if (!Number.isFinite(definido) || !(pedido > 0)) return false;
  return Math.abs(definido - pedido) > 0.005;
}

/**
 * Formatação monetária da tela: vírgula decimal, igual ao CSV e à impressão —
 * zero é sempre apresentado como "0,00".
 */
export function formatCeasaMoney(value) {
  return (Number(value) || 0).toFixed(2).replace('.', ',');
}