/**
 * Conferência CEASA: detecção de divergências e plano de reconciliação.
 * O módulo é somente leitura — nenhum teste aqui grava nada.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCeasaAudit, buildReconcilePlan } from '../base44/shared/ceasaAudit.js';

const item = (over = {}) => ({
  line_id: 'l1',
  product_id: 'p1',
  product_name: 'Tomate',
  quantity: 1,
  unit_price: 0,
  final_unit_price: 100,
  ...over,
});

const order = (over = {}) => ({
  id: 'o1',
  order_number: 1,
  requires_nfe: true,
  status: 'Confirmado',
  nfe_company_name: 'Cliente LTDA',
  items: [item()],
  ...over,
});

const operation = (over = {}) => ({
  id: 'op1',
  order_id: 'o1',
  line_id: 'l1',
  product_name: 'Tomate',
  quantity: 1,
  active: true,
  ceasa_value: 100,
  box_id: 'b1',
  box_name: 'Box 1',
  caminhao: '',
  notes: '',
  created_date: '2026-09-01T10:00:00.000000',
  ...over,
});

const box = { id: 'b1', name: 'Box 1', active: true };
const findCategory = (audit, key) => audit.categories.find(category => category.key === key);

test('categoria: operação ativa em pedido sem NF-e é divergência corrigível', () => {
  const audit = buildCeasaAudit({
    orders: [order({ requires_nfe: false })],
    operations: [operation()],
    boxes: [box],
  });

  const categoria = findCategory(audit, 'ops_sem_nfe');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].actionable, true);

  const plan = buildReconcilePlan(audit);
  assert.deepEqual(plan.deactivate, [{ id: 'op1', active: false, order_id: 'o1' }]);
});

test('categoria: pedido inexistente não é corrigido automaticamente', () => {
  const audit = buildCeasaAudit({
    orders: [],
    operations: [operation({ order_id: 'apagado' })],
    boxes: [box],
  });

  const categoria = findCategory(audit, 'ops_sem_nfe');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].actionable, false, 'depende de decisão humana');
  assert.equal(buildReconcilePlan(audit).deactivate.length, 0);
});

test('categoria: valor CEASA zerado em item precificado', () => {
  const audit = buildCeasaAudit({
    orders: [order()],
    operations: [operation({ ceasa_value: 0 })],
    boxes: [box],
  });

  const categoria = findCategory(audit, 'valor_zero');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].actionable, false, 'nunca é recalculado automaticamente');
  assert.match(categoria.rows[0].detalhe, /100\.00/);
});

test('categoria: valor CEASA zerado em item SEM preço comercial não é divergência', () => {
  const audit = buildCeasaAudit({
    orders: [order({ items: [item({ final_unit_price: 0, unit_price: 0 })] })],
    operations: [operation({ ceasa_value: 0 })],
    boxes: [box],
  });

  assert.equal(findCategory(audit, 'valor_zero').rows.length, 0);
});

test('categoria: operação apontando para Box inexistente', () => {
  const audit = buildCeasaAudit({
    orders: [order()],
    operations: [operation({ box_id: 'box-apagado', box_name: 'Capital' })],
    boxes: [],
  });

  const categoria = findCategory(audit, 'box_inexistente');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].box, 'Capital');
});

test('categoria: Box inativado NÃO é divergência', () => {
  const audit = buildCeasaAudit({
    orders: [order()],
    operations: [operation({ box_id: 'b2' })],
    boxes: [{ id: 'b2', name: 'Box inativo', active: false }],
  });

  assert.equal(findCategory(audit, 'box_inexistente').rows.length, 0);
});

test('categoria: duplicidade ativa na mesma linha', () => {
  const audit = buildCeasaAudit({
    orders: [order()],
    operations: [
      operation({ id: 'op1', created_date: '2026-09-01T10:00:00.000000' }),
      operation({ id: 'op2', created_date: '2026-09-05T10:00:00.000000' }),
    ],
    boxes: [box],
  });

  assert.equal(findCategory(audit, 'duplicidade_ativa').rows.length, 2);
});

test('categoria: item de pedido com NF-e sem operação ativa (bonificação fica fora)', () => {
  const audit = buildCeasaAudit({
    orders: [order({ items: [item(), item({ line_id: 'l2', product_name: 'Alface' }), item({ line_id: 'l3', product_name: 'Brinde', is_bonus: true })] })],
    operations: [operation()],
    boxes: [box],
  });

  const categoria = findCategory(audit, 'item_sem_operacao');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].produto, 'Alface');
});

test('categoria: item sem identidade de linha é sinalizado', () => {
  const audit = buildCeasaAudit({
    orders: [order({ items: [item({ line_id: null })] })],
    operations: [],
    boxes: [],
  });

  const categoria = findCategory(audit, 'item_sem_operacao');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].actionable, true);
  assert.match(categoria.rows[0].detalhe, /identidade/);
});

test('categoria: conta a receber sem pedido de origem', () => {
  const audit = buildCeasaAudit({
    orders: [order()],
    operations: [],
    boxes: [],
    receivables: [
      { id: 'r1', order_id: 'pedido-apagado', order_number: 9, customer_name: 'Cliente X', total_amount: 250, status: 'aberta' },
      { id: 'r2', order_id: 'o1', total_amount: 10 },
    ],
  });

  const categoria = findCategory(audit, 'conta_sem_pedido');
  assert.equal(categoria.rows.length, 1);
  assert.equal(categoria.rows[0].order_id, 'pedido-apagado');
  assert.match(categoria.rows[0].detalhe, /250\.00/);
});

test('relatório: contadores por categoria e total', () => {
  const audit = buildCeasaAudit({
    orders: [order({ requires_nfe: false })],
    operations: [operation({ ceasa_value: 0 }), operation({ id: 'op2', line_id: 'l9', box_id: 'x', box_name: 'Sumiu' })],
    boxes: [box],
  });

  assert.equal(audit.counts.ops_sem_nfe, 2);
  assert.equal(audit.counts.valor_zero, 1);
  assert.equal(audit.counts.box_inexistente, 1);
  assert.equal(audit.counts.total, 4);
  assert.equal(audit.scanned.active_operations, 2);
  assert.equal(audit.categories.length, 6);
});

test('plano: a reconciliação só inativa operações de pedido sem NF-e', () => {
  const audit = buildCeasaAudit({
    orders: [order({ requires_nfe: false }), order({ id: 'o2', order_number: 2 })],
    operations: [
      operation({ id: 'sem-nfe', order_id: 'o1' }),
      operation({ id: 'com-nfe', order_id: 'o2', line_id: 'l1' }),
      operation({ id: 'valor-zero', order_id: 'o2', line_id: 'l1', ceasa_value: 0 }),
    ],
    boxes: [box],
  });

  const plan = buildReconcilePlan(audit);
  assert.deepEqual(plan.deactivate.map(a => a.id), ['sem-nfe']);
  assert.ok(plan.counts.informational > 0);
});