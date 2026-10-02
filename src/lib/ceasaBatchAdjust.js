/**
 * Ajuste em lote dos valores CEASA de um pedido (meia nota ou percentual).
 *
 * Módulo puro (testável em tests/ceasaBatchAdjust.test.mjs): recebe as linhas da
 * Gestão CEASA e devolve a PRÉVIA exibida ao operador e o PLANO do que será
 * gravado — sem tocar em banco. Regras:
 *  - o ajuste é estritamente por pedido: linha de outro pedido/cliente nunca entra
 *    na prévia nem no plano (identidade order_id + line_id);
 *  - só participam operações com valor CEASA DEFINIDO e diferente de zero — zero
 *    permanece zero e item sem valor informado não é ajustado;
 *  - o plano carrega apenas identidade e valor: preço comercial, quantidade, Box,
 *    caminhão, observação e o pedido não têm como ser alterados;
 *  - a redução usa o arredondamento monetário do projeto (duas casas).
 */
import { isCeasaValueAdjustable, reduceCeasaValue } from './ceasaValue.js';

/** Meia nota: redução de 50% nos valores selecionados. */
export const MEIA_NOTA_PERCENT = 50;

/** Percentual válido do ajuste: maior que zero e no máximo 100%. */
export function isValidAdjustPercent(percent) {
  const value = Number(percent);
  return Number.isFinite(value) && value > 0 && value <= 100;
}

/** Por que a linha não participa do ajuste (exibido na prévia). */
function motivoNaoAjustavel(operation) {
  if (!operation) return 'sem-operacao';
  if (operation.ceasa_value == null) return 'sem-valor';
  if (Number(operation.ceasa_value) === 0) return 'zero';
  return null;
}

/**
 * Prévia do ajuste em lote de UM pedido.
 *
 * `selectedLineIds` são os itens marcados pelo operador (todos os ajustáveis por
 * padrão). Devolve as linhas para exibição e os ajustes a gravar — somente
 * selecionados, ajustáveis e com percentual válido. Não altera nenhuma entrada.
 */
export function buildCeasaBatchPreview(rows = [], orderId, percent, selectedLineIds = []) {
  const marcados = new Set(selectedLineIds);
  const percentualValido = isValidAdjustPercent(percent);
  const linhas = [];
  const ajustes = [];
  let selecionados = 0;
  let totalAnterior = 0;
  let totalNovo = 0;

  (rows || []).forEach(r => {
    // Nunca sai do pedido informado — nenhuma linha de outro cliente/pedido entra.
    if (!orderId || r?.orderId !== orderId) return;

    const valorAtual = r.operation?.ceasa_value != null ? Number(r.operation.ceasa_value) : null;
    const ajustavel = isCeasaValueAdjustable(r.operation);
    const marcado = ajustavel && marcados.has(r.lineId);
    const aplicar = marcado && percentualValido;
    const valorNovo = aplicar ? reduceCeasaValue(valorAtual, percent) : valorAtual;

    linhas.push({
      lineId: r.lineId,
      produto: r.produto,
      ajustavel,
      marcado,
      motivo: ajustavel ? null : motivoNaoAjustavel(r.operation),
      valorAtual,
      valorNovo,
    });

    if (aplicar) {
      ajustes.push({
        orderId: r.orderId,
        lineId: r.lineId,
        produto: r.produto,
        de: valorAtual,
        para: valorNovo,
      });
    }
    // Totais dos itens MARCADOS: antes de informar o percentual o novo total
    // acompanha o anterior; com percentual, mostra exatamente o efeito do ajuste.
    if (marcado) {
      selecionados += 1;
      totalAnterior += valorAtual;
      totalNovo += valorNovo;
    }
  });

  return { linhas, ajustes, selecionados, totalAnterior, totalNovo };
}