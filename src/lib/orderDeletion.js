/**
 * Plano de exclusão de um pedido (módulo puro, testável).
 *
 * Excluir um pedido:
 *  - remove a conta a receber gerada por ele (evita fatura órfã no financeiro);
 *  - inativa as operações CEASA do pedido, preservando Box, valor CEASA,
 *    caminhão e observação (o histórico da separação nunca é apagado);
 *  - não toca em nenhum outro lançamento financeiro (Transaction, boleto, cheque).
 */
export function buildOrderDeletionPlan({ receivables = [], operations = [] } = {}) {
  const receivableIds = receivables.map((item) => item.id).filter(Boolean);
  const operationIds = operations
    .filter((op) => op.active !== false)
    .map((op) => op.id)
    .filter(Boolean);

  return {
    receivableIds,
    operationIds,
    counts: {
      receivables: receivableIds.length,
      operations: operationIds.length,
      preservedOperations: operations.length - operationIds.length,
    },
  };
}