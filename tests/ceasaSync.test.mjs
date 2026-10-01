/**
 * Testes da sincronização Pedido → CEASA com identidade estável (order_id + line_id).
 * Rodar com: npm test   (node --test tests/)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignLineIds,
  buildSyncPlan,
  itemKeyFor,
  syncCeasaFromOrder,
} from '../base44/shared/ceasaSync.js';

let seq = 0;
const nextId = (prefix) => `${prefix}${++seq}`;

function makeStore(orderPatch = {}) {
  const operations = [];
  const order = {
    id: 'o1',
    requires_nfe: true,
    created_date: '2026-09-01T15:00:00.000Z',
    customer_name: 'Cliente',
    customer_display_name: 'Cliente',
    nfe_company_name: 'Cliente LTDA',
    nfe_cnpj: '00.000.000/0001-00',
    items: [],
    ...orderPatch,
  };

  const deps = {
    listOperations: async (orderId) => operations.filter(o => o.order_id === orderId).map(o => ({ ...o })),
    updateOrderItems: async (_orderId, items) => { order.items = items; },
    createOperations: async (records) => {
      records.forEach(r => operations.push({
        id: nextId('op'),
        created_date: new Date(2026, 8, 1, 12, seq).toISOString(),
        box_id: '',
        box_name: '',
        caminhao: '',
        notes: '',
        ...r,
      }));
    },
    updateOperations: async (patches) => {
      patches.forEach(p => {
        const target = operations.find(o => o.id === p.id);
        assert.ok(target, `operação ${p.id} deve existir`);
        Object.assign(target, p);
      });
    },
  };

  return { order, operations, deps, sync: () => syncCeasaFromOrder(order, deps) };
}

const line = (productId, name, quantity, price) => ({
  product_id: productId,
  product_name: name,
  quantity,
  unit_price: price,
  final_unit_price: price,
});

const opOf = (operations, lineId) => operations.find(o => o.line_id === lineId);

test('1. criar pedido com 3 itens → 3 operações CEASA', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8), line('p3', 'Cenoura', 3, 6)];

  const res = await sync();

  assert.equal(res.created, 3);
  assert.equal(operations.length, 3);
  assert.ok(order.items.every(i => i.line_id), 'todo item recebe line_id');
  assert.equal(new Set(order.items.map(i => i.line_id)).size, 3, 'identidades distintas');
  operations.forEach(op => {
    assert.ok(op.line_id);
    assert.equal(op.item_key, itemKeyFor('o1', op.line_id), 'item_key reflete a nova identidade');
    assert.equal(op.active, true);
    assert.equal(op.box_id, '');
    assert.equal(op.caminhao, '');
    assert.equal(op.notes, '');
  });
  assert.deepEqual(operations.map(o => o.ceasa_value), [12, 8, 6], 'ceasa_value inicial = final_unit_price');
});

test('2. alterar quantidade → mesma operação, quantidade atualizada', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  const lineId = order.items[0].line_id;
  const opId = operations[0].id;

  order.items = [{ ...order.items[0], quantity: 25 }];
  const res = await sync();

  assert.equal(res.created, 0);
  assert.equal(operations.length, 1, 'não duplica a operação');
  assert.equal(operations[0].id, opId);
  assert.equal(operations[0].quantity, 25);
  assert.equal(operations[0].line_id, lineId);
});

test('3. alterar preço → operação preserva o valor CEASA já definido', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  operations[0].ceasa_value = 99; // valor CEASA definido pelo operador

  order.items = [{ ...order.items[0], unit_price: 30, final_unit_price: 30 }];
  await sync();

  assert.equal(operations[0].ceasa_value, 99, 'preço do pedido não altera o valor CEASA');
  assert.equal(operations[0].quantity, 10);
});

test('4. adicionar item → nova operação, itens antigos intactos', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  const idsBefore = operations.map(o => o.id);

  order.items = [...order.items, line('p3', 'Cenoura', 3, 6)];
  const res = await sync();

  assert.equal(res.created, 1);
  assert.equal(operations.length, 3);
  assert.deepEqual(operations.map(o => o.id).filter(id => idsBefore.includes(id)), idsBefore);
  assert.equal(opOf(operations, order.items[2].line_id).ceasa_value, 6);
});

test('5. remover item → operação correspondente fica inativa (sem perder a configuração)', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  const removedLineId = order.items[1].line_id;
  const removedOp = opOf(operations, removedLineId);
  removedOp.box_id = 'b9';
  removedOp.box_name = 'Box 9';
  removedOp.caminhao = 'Caminhão 1';

  order.items = [order.items[0]];
  const res = await sync();

  assert.equal(res.deactivated, 1);
  assert.equal(res.created, 0);
  const after = opOf(operations, removedLineId);
  assert.equal(after.active, false, 'operação inativa, não apagada');
  assert.equal(after.box_id, 'b9', 'Box preservado');
  assert.equal(after.caminhao, 'Caminhão 1', 'caminhão preservado');

  const plan = buildSyncPlan(order, operations);
  assert.equal(plan.deactivate.length, 0, 'não desativa duas vezes');
});

test('6. reordenar itens → nenhuma operação muda de produto', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8), line('p3', 'Cenoura', 3, 6)];
  await sync();
  const snapshot = operations.map(o => ({ id: o.id, line_id: o.line_id, product_id: o.product_id, product_name: o.product_name, quantity: o.quantity }));

  const [a, b, c] = order.items;
  order.items = [c, a, b]; // reordena sem alterar nenhum item
  const res = await sync();

  assert.equal(res.created, 0);
  assert.equal(res.deactivated, 0);
  assert.equal(operations.length, 3);
  assert.deepEqual(
    operations.map(o => ({ id: o.id, line_id: o.line_id, product_id: o.product_id, product_name: o.product_name, quantity: o.quantity })),
    snapshot,
    'a posição no array não muda a identidade nem o produto da operação'
  );
});

test('7. alterar produto de uma linha → mesma line_id, operação reflete o novo produto', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  const lineId = order.items[0].line_id;
  const opId = opOf(operations, lineId).id;

  order.items = [
    { ...order.items[0], product_id: 'p9', product_name: 'Pepino', unit_price: 20, final_unit_price: 20 },
    order.items[1],
  ];
  await sync();

  const op = operations.find(o => o.id === opId);
  assert.equal(op.line_id, lineId, 'identidade preservada');
  assert.equal(op.product_id, 'p9');
  assert.equal(op.product_name, 'Pepino');
  assert.equal(operations.length, 2, 'não cria operação extra');
});

test('8. Box permanece após sincronização', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  operations[0].box_id = 'box-7';
  operations[0].box_name = 'Box 07';

  order.items = [{ ...order.items[0], quantity: 40 }];
  await sync();

  assert.equal(operations[0].box_id, 'box-7');
  assert.equal(operations[0].box_name, 'Box 07');
  assert.equal(operations[0].quantity, 40);
});

test('9. Caminhão permanece após sincronização', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  operations[0].caminhao = 'Caminhão 3 - João';

  order.items = [{ ...order.items[0], quantity: 12 }];
  await sync();

  assert.equal(operations[0].caminhao, 'Caminhão 3 - João');
});

test('10. Observação permanece após sincronização', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  operations[0].notes = 'Conferir peso';

  order.items = [{ ...order.items[0], product_name: 'Tomate Italiano' }];
  await sync();

  assert.equal(operations[0].notes, 'Conferir peso');
  assert.equal(operations[0].product_name, 'Tomate Italiano');
});

test('11. requires_nfe = false → operações deixam de participar do CEASA', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();

  order.requires_nfe = false;
  const res = await sync();

  assert.equal(res.mode, 'disabled');
  assert.equal(res.deactivated, 2);
  assert.ok(operations.every(o => o.active === false));
});

test('12. voltar para requires_nfe = true → itens são sincronizados novamente', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  order.requires_nfe = false;
  await sync();

  order.requires_nfe = true;
  order.items = [{ ...order.items[0], quantity: 15 }, order.items[1]];
  const res = await sync();

  assert.equal(res.created, 0, 'reaproveita as operações existentes');
  assert.equal(res.updated, 2);
  assert.ok(operations.every(o => o.active === true));
  assert.equal(opOf(operations, order.items[0].line_id).quantity, 15);
});

test('duplicidade: mantém a operação mais recente e inativa a duplicata antiga', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  await sync();
  const antiga = operations[0];
  antiga.box_id = 'box-antigo';
  antiga.ceasa_value = 1;

  // Operação mais recente: é a que a Gestão exibe e onde o operador configurou
  operations.push({
    ...antiga,
    id: 'op-recente',
    box_id: 'box-novo',
    box_name: 'Box 12',
    ceasa_value: 99,
    created_date: new Date(2026, 8, 2).toISOString(),
  });

  const res = await sync();

  assert.equal(res.duplicates, 1);
  assert.equal(res.created, 0);
  assert.equal(operations.find(o => o.id === 'op-recente').active, true, 'canônica permanece ativa');
  assert.equal(operations.find(o => o.id === 'op-recente').ceasa_value, 99);
  assert.equal(operations.find(o => o.id === 'op-recente').box_name, 'Box 12');
  assert.equal(operations.find(o => o.id === antiga.id).active, false, 'duplicata antiga inativada');
  assert.equal(operations.find(o => o.id === antiga.id).ceasa_value, 1, 'duplicata preservada, não apagada');

  const again = await sync();
  assert.equal(again.deactivated, 0, 'idempotente');
  assert.equal(operations.find(o => o.id === 'op-recente').active, true);
});

test('migração: item sem line_id adota a operação da chave legada preservando a configuração', async () => {
  const { order, operations, sync } = makeStore();
  // Estado pré-migração: item sem identidade + operação com item_key "order_id:indice"
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  operations.push(
    { id: 'leg-0', order_id: 'o1', item_key: 'o1:0', product_id: 'p1', product_name: 'Tomate', quantity: 10, box_id: 'b1', box_name: 'Box 01', ceasa_value: 9, caminhao: 'Caminhão 2', notes: 'conferido', created_date: '2026-09-01T12:00:00.000Z' },
    { id: 'leg-1', order_id: 'o1', item_key: 'o1:1', product_id: 'p2', product_name: 'Alface', quantity: 5, created_date: '2026-09-01T12:01:00.000Z' },
  );

  const res = await sync();

  assert.equal(res.created, 0, 'não cria operação nova para item migrado');
  assert.equal(res.line_ids_generated, 2);
  const adopted = operations.find(o => o.id === 'leg-0');
  assert.equal(adopted.line_id, order.items[0].line_id, 'adota a identidade do item');
  assert.equal(adopted.item_key, itemKeyFor('o1', order.items[0].line_id));
  assert.equal(adopted.box_id, 'b1');
  assert.equal(adopted.ceasa_value, 9);
  assert.equal(adopted.caminhao, 'Caminhão 2');
  assert.equal(adopted.notes, 'conferido');
});

test('line_id nunca é regenerado ao editar o pedido', async () => {
  const { order, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  const before = order.items.map(i => i.line_id);

  order.items = [
    { ...order.items[0], quantity: 99, product_id: 'p9', product_name: 'Pepino', final_unit_price: 5 },
    order.items[1],
  ];
  await sync();
  await sync();

  assert.deepEqual(order.items.map(i => i.line_id), before);
  assert.equal(assignLineIds(order.items).changed, false, 'nada a gerar quando a identidade já existe');
});

test('sincronização é idempotente quando nada muda no pedido', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), line('p2', 'Alface', 5, 8)];
  await sync();
  const snapshot = JSON.stringify(operations);

  const res = await sync();

  assert.equal(res.created, 0);
  assert.equal(res.deactivated, 0);
  assert.equal(res.line_ids_generated, 0);
  assert.equal(JSON.stringify(operations), snapshot);
});

test('bonificação não participa da Gestão CEASA mas recebe identidade', async () => {
  const { order, operations, sync } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12), { ...line('p2', 'Alface', 2, 0), is_bonus: true }];
  await sync();

  assert.equal(operations.length, 1);
  assert.ok(order.items[1].line_id, 'item bonificado também tem identidade estável');
});

test('a sincronização não escreve no pedido quando a identidade já existe', async () => {
  const { order, deps } = makeStore();
  order.items = [line('p1', 'Tomate', 10, 12)];
  const withIds = assignLineIds(order.items).items;
  order.items = withIds;
  let orderWrites = 0;
  const res = await syncCeasaFromOrder(order, {
    ...deps,
    updateOrderItems: async (_id, items) => { orderWrites++; order.items = items; },
  });

  assert.equal(orderWrites, 0);
  assert.equal(res.line_ids_generated, 0);
});