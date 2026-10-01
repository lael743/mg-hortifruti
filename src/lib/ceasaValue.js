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
 * Linha em atenção: a operação tem valor CEASA zerado enquanto o item tem preço
 * comercial — o operador precisa digitar o valor. Valores definidos (inclusive 0
 * digitado) nunca são recalculados automaticamente.
 */
export function isCeasaValuePending(operation, item) {
  if (!operation || operation.ceasa_value == null) return false;
  return Number(operation.ceasa_value) === 0 && effectiveUnitPrice(item) > 0;
}