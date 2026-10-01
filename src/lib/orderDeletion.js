/**
 * Plano de exclusão de um pedido (módulo puro, testável).
 *
 * Excluir um pedido:
 *  - remove a conta a receber SEM movimento financeiro (evita fatura órfã);
 *  - conta a receber COM movimento (parcela paga, data de pagamento, status
 *    parcial ou quitado) NÃO é excluída: é CANCELADA, preservando o histórico
 *    financeiro. Nesse caso o pedido também não é excluído — passa a
 *    'Cancelado' (status que já existe no schema), para o título não ficar
 *    órfão e a conciliação continuar possível;
 *  - inativa as operações CEASA do pedido, preservando Box, valor CEASA,
 *    caminhão e observação (o histórico da separação nunca é apagado);
 *  - não toca em nenhum outro lançamento financeiro (Transaction, boleto, cheque).
 */

/**
 * A conta a receber tem movimento financeiro?
 * Considera apenas o que já existe no schema: parcelas pagas ou com data de
 * pagamento, e os status de recebimento parcial/quitado. Uma conta já cancelada
 * não tem movimento.
 */
export function hasFinancialMovement(receivable) {
  if (!receivable) return false;
  if (receivable.status === 'parcialmente_paga' || receivable.status === 'quitada') return true;
  return (receivable.installments || []).some(
    (installment) => installment?.status === 'paga' || Boolean(installment?.paid_date),
  );
}

export function buildOrderDeletionPlan({ receivables = [], operations = [] } = {}) {
  const receivableIds = receivables
    .filter((receivable) => !hasFinancialMovement(receivable))
    .map((receivable) => receivable.id)
    .filter(Boolean);
  const cancelReceivableIds = receivables
    .filter((receivable) => hasFinancialMovement(receivable))
    .map((receivable) => receivable.id)
    .filter(Boolean);
  const operationIds = operations
    .filter((op) => op.active !== false)
    .map((op) => op.id)
    .filter(Boolean);

  return {
    receivableIds,
    cancelReceivableIds,
    cancelOrder: cancelReceivableIds.length > 0,
    operationIds,
    counts: {
      receivables: receivableIds.length,
      cancelledReceivables: cancelReceivableIds.length,
      operations: operationIds.length,
      preservedOperations: operations.length - operationIds.length,
    },
  };
}