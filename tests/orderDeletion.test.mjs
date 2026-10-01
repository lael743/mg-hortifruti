/**
 * Plano de exclusão de pedido: o que é removido, o que é inativado e o que
 * permanece intocado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderDeletionPlan } from '../src/lib/orderDeletion.js';

test('exclusão: remove a conta a receber do pedido e inativa as operações CEASA ativas', () => {
  const plan = buildOrderDeletionPlan({
    receivables: [{ id: 'r1' }, { id: 'r2' }],
    operations: [
      { id: 'op1', active: true },
      { id: 'op2', active: undefined },
      { id: 'op3', active: false },
    ],
  });

  assert.deepEqual(plan.receivableIds, ['r1', 'r2']);
  assert.deepEqual(plan.operationIds, ['op1', 'op2'], 'apenas as ativas precisam ser inativadas');
  assert.deepEqual(plan.counts, { receivables: 2, operations: 2, preservedOperations: 1 });
});

test('exclusão: pedido sem vínculos não gera nenhuma ação', () => {
  const plan = buildOrderDeletionPlan({ receivables: [], operations: [] });
  assert.deepEqual(plan.receivableIds, []);
  assert.deepEqual(plan.operationIds, []);
  assert.equal(plan.counts.receivables, 0);
});

test('exclusão: operações já inativas são preservadas como estão', () => {
  const plan = buildOrderDeletionPlan({ receivables: [], operations: [{ id: 'a', active: false }, { id: 'b', active: false }] });
  assert.deepEqual(plan.operationIds, []);
  assert.equal(plan.counts.preservedOperations, 2);
});

test('exclusão: entradas ausentes não quebram o plano', () => {
  const plan = buildOrderDeletionPlan({});
  assert.deepEqual(plan.counts, { receivables: 0, operations: 0, preservedOperations: 0 });
});