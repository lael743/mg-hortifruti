/**
 * Plano de exclusão de pedido: o que é excluído, o que é cancelado (histórico
 * financeiro preservado) e o que permanece intocado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderDeletionPlan, hasFinancialMovement } from '../src/lib/orderDeletion.js';

test('movimento financeiro: parcela paga, data de pagamento, parcial ou quitado', () => {
  assert.equal(hasFinancialMovement({ status: 'pendente_definicao', installments: [] }), false);
  assert.equal(hasFinancialMovement({ status: 'aberta', installments: [{ status: 'pendente' }] }), false);
  assert.equal(hasFinancialMovement({ status: 'cancelada', installments: [] }), false, 'título já cancelado não tem movimento');
  assert.equal(hasFinancialMovement({ status: 'aberta', installments: [{ status: 'pendente' }, { status: 'paga' }] }), true);
  assert.equal(hasFinancialMovement({ status: 'aberta', installments: [{ status: 'pendente', paid_date: '2026-09-10' }] }), true);
  assert.equal(hasFinancialMovement({ status: 'parcialmente_paga', installments: [] }), true);
  assert.equal(hasFinancialMovement({ status: 'quitada', installments: [] }), true);
  assert.equal(hasFinancialMovement(null), false);
});

test('exclusão SEM movimento: mantém o comportamento atual (remove a conta e inativa as operações ativas)', () => {
  const plan = buildOrderDeletionPlan({
    receivables: [
      { id: 'r1', status: 'pendente_definicao', installments: [] },
      { id: 'r2', status: 'aberta', installments: [{ status: 'pendente' }] },
    ],
    operations: [
      { id: 'op1', active: true },
      { id: 'op2', active: undefined },
      { id: 'op3', active: false },
    ],
  });

  assert.deepEqual(plan.receivableIds, ['r1', 'r2']);
  assert.deepEqual(plan.cancelReceivableIds, []);
  assert.equal(plan.cancelOrder, false, 'pedido continua sendo excluído');
  assert.deepEqual(plan.operationIds, ['op1', 'op2'], 'apenas as ativas precisam ser inativadas');
  assert.deepEqual(plan.counts, { receivables: 2, cancelledReceivables: 0, operations: 2, preservedOperations: 1 });
});

test('exclusão COM movimento: a conta é cancelada (nunca excluída) e o pedido é cancelado', () => {
  const plan = buildOrderDeletionPlan({
    receivables: [
      {
        id: 'r1',
        status: 'parcialmente_paga',
        installments: [{ status: 'paga', paid_date: '2026-09-10' }, { status: 'pendente' }],
      },
    ],
    operations: [{ id: 'op1', active: true }],
  });

  assert.deepEqual(plan.receivableIds, [], 'nada é excluído');
  assert.deepEqual(plan.cancelReceivableIds, ['r1']);
  assert.equal(plan.cancelOrder, true, 'pedido cancelado para o título não ficar órfão');
  assert.deepEqual(plan.operationIds, ['op1'], 'histórico da separação segue preservado');
  assert.deepEqual(plan.counts, { receivables: 0, cancelledReceivables: 1, operations: 1, preservedOperations: 0 });
});

test('exclusão MISTA: sem movimento é excluída, com movimento é cancelada', () => {
  const plan = buildOrderDeletionPlan({
    receivables: [
      { id: 'sem', status: 'pendente_definicao', installments: [] },
      { id: 'com', status: 'quitada', installments: [{ status: 'paga', paid_date: '2026-09-01' }] },
    ],
    operations: [],
  });

  assert.deepEqual(plan.receivableIds, ['sem']);
  assert.deepEqual(plan.cancelReceivableIds, ['com']);
  assert.equal(plan.cancelOrder, true);
  assert.equal(plan.counts.cancelledReceivables, 1);
});

test('exclusão: operações já inativas são preservadas como estão', () => {
  const plan = buildOrderDeletionPlan({ receivables: [], operations: [{ id: 'a', active: false }, { id: 'b', active: false }] });
  assert.deepEqual(plan.operationIds, []);
  assert.equal(plan.counts.preservedOperations, 2);
});

test('exclusão: pedido sem vínculos não gera nenhuma ação', () => {
  const plan = buildOrderDeletionPlan({ receivables: [], operations: [] });
  assert.deepEqual(plan.receivableIds, []);
  assert.deepEqual(plan.cancelReceivableIds, []);
  assert.equal(plan.cancelOrder, false);
  assert.equal(plan.counts.receivables, 0);
});

test('exclusão: entradas ausentes não quebram o plano', () => {
  const plan = buildOrderDeletionPlan({});
  assert.deepEqual(plan.counts, { receivables: 0, cancelledReceivables: 0, operations: 0, preservedOperations: 0 });
});