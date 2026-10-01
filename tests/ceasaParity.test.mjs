/**
 * Paridade da resolução canônica de operações CEASA.
 *
 * A regra existe em duas cópias por limitação da plataforma: uma no cliente
 * (src/lib/ceasaOperations.js) e outra no servidor
 * (base44/shared/ceasaOperationRules.js), porque o diretório base44/ não é
 * empacotado no bundle do navegador. Estes testes rodam as DUAS implementações
 * sobre as mesmas fixtures e exigem a mesma escolha — sem isso, a leitura poderia
 * apontar para uma operação e a sincronização para outra.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCanonicalOperation } from '../base44/shared/ceasaOperationRules.js';
import { pickOperation, indexOperationsByLine, operationKey, operationsForLine } from '../src/lib/ceasaOperations.js';
import { buildSyncPlan } from '../base44/shared/ceasaSync.js';

const op = (over = {}) => ({
  id: 'op',
  order_id: 'o1',
  line_id: 'l1',
  active: true,
  box_id: '',
  box_name: '',
  ceasa_value: 0,
  caminhao: '',
  notes: '',
  created_date: '2026-09-01T10:00:00.000000',
  ...over,
});

const FIXTURES = [
  { nome: 'operação única', ops: [op({ id: 'a' })] },
  {
    nome: 'duas ativas',
    ops: [
      op({ id: 'antiga', created_date: '2026-09-01T10:00:00.000000' }),
      op({ id: 'recente', created_date: '2026-09-02T10:00:00.000000' }),
    ],
  },
  {
    nome: 'recente inativa',
    ops: [
      op({ id: 'ativa', created_date: '2026-09-01T10:00:00.000000' }),
      op({ id: 'inativa-recente', active: false, created_date: '2026-09-03T10:00:00.000000' }),
    ],
  },
  {
    nome: 'todas inativas',
    ops: [
      op({ id: 'i1', active: false, created_date: '2026-09-01T10:00:00.000000' }),
      op({ id: 'i2', active: false, created_date: '2026-09-04T10:00:00.000000' }),
    ],
  },
  {
    nome: 'sem campo active',
    ops: [
      op({ id: 'x', active: undefined, created_date: '2026-09-01T10:00:00.000000' }),
      op({ id: 'y', active: undefined, created_date: '2026-09-02T10:00:00.000000' }),
    ],
  },
  { nome: 'vazia', ops: [] },
];

test('paridade: leitura e sincronização escolhem a mesma operação canônica', () => {
  FIXTURES.forEach(({ nome, ops }) => {
    const leitura = pickOperation(ops);
    const sincronizacao = pickCanonicalOperation(ops);
    assert.equal(
      leitura?.id ?? null,
      sincronizacao?.id ?? null,
      `${nome}: canônica divergente entre leitura e sincronização`
    );
  });
});

test('paridade: o índice da Gestão usa a mesma canônica', () => {
  FIXTURES.forEach(({ nome, ops }) => {
    const index = indexOperationsByLine(ops);
    const escolhida = index[operationKey('o1', 'l1')];
    assert.equal(
      escolhida?.id ?? null,
      pickCanonicalOperation(ops)?.id ?? null,
      `${nome}: índice divergente`
    );
  });
});

test('paridade: a sincronização atualiza a MESMA operação que a Gestão exibe', () => {
  const ops = [
    op({ id: 'ativa-antiga', box_id: 'b1', box_name: 'Box 1', created_date: '2026-09-01T10:00:00.000000' }),
    op({ id: 'inativa-recente', active: false, created_date: '2026-09-09T10:00:00.000000' }),
  ];
  const order = {
    id: 'o1',
    requires_nfe: true,
    items: [{ line_id: 'l1', product_id: 'p1', product_name: 'Tomate', quantity: 2, unit_price: 10, final_unit_price: 10 }],
  };

  const plan = buildSyncPlan(order, ops);
  const exibida = pickOperation(operationsForLine(ops, 'o1', 'l1'));

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, exibida.id, 'gravação e exibição apontam para a mesma operação');
  assert.equal(plan.creates.length, 0);
});

test('paridade: item sem identidade adota a operação da chave legada nas duas pontas', () => {
  const order = {
    id: 'o1',
    requires_nfe: true,
    items: [{ product_id: 'p1', product_name: 'Tomate', quantity: 2, unit_price: 10, final_unit_price: 10 }],
  };
  const legada = {
    id: 'leg-0',
    order_id: 'o1',
    item_key: 'o1:0',
    product_id: 'p1',
    product_name: 'Tomate',
    quantity: 2,
    active: true,
    ceasa_value: 10,
    box_id: 'b1',
    box_name: 'Box 1',
    caminhao: '',
    notes: '',
    created_date: '2026-09-01T10:00:00.000000',
  };

  const plan = buildSyncPlan(order, [legada]);

  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates[0].id, 'leg-0');
  assert.equal(plan.lineIdsChanged, true);
});