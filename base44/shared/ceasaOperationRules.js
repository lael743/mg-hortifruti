/**
 * Regra canônica da operação CEASA de uma linha (módulo puro, sem SDK).
 *
 * Cópia server-side da MESMA regra de src/lib/ceasaOperations.js — o diretório
 * base44/ é server-side e não pode importar src/, e o cliente não pode importar
 * base44/. A paridade das duas cópias é verificada por tests/ceasaParity.test.mjs,
 * que roda as duas implementações sobre as mesmas fixtures.
 *
 * A operação canônica de uma linha (order_id + line_id) é a MAIS RECENTE ATIVA;
 * se a linha não tiver nenhuma ativa, a mais recente. Assim a leitura (Gestão,
 * impressão, CSV), a gravação (salvar linha, aplicar Box, aplicar caminhão) e a
 * sincronização apontam sempre para o mesmo registro.
 */

export function newestFirst(a, b) {
  return String(b?.created_date || '').localeCompare(String(a?.created_date || ''));
}

export function pickCanonicalOperation(operations) {
  const ops = [...(operations || [])].sort(newestFirst);
  if (!ops.length) return null;
  return ops.find(op => op.active !== false) || ops[0];
}