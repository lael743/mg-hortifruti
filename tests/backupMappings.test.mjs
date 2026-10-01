/**
 * Restauração de backup: os relacionamentos (conta a receber → pedido e
 * operação CEASA → pedido) são reapontados para os IDs novos, sem perder
 * nenhum dado quando não há correspondência.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderIdMap,
  collectionOf,
  remapOrderReference,
  toRestorable,
} from '../src/lib/backupMappings.js';

test('mapa de pedidos: casa pelo order_number entre o arquivo e os registros criados', () => {
  const map = buildOrderIdMap(
    [{ id: 'old-1', order_number: 101 }, { id: 'old-2', order_number: 102 }],
    [{ id: 'new-1', order_number: 101 }, { id: 'new-2', order_number: 102 }],
  );

  assert.equal(map.get('old-1'), 'new-1');
  assert.equal(map.get('old-2'), 'new-2');
  assert.equal(map.size, 2);
});

test('mapa de pedidos: pedido ausente na criação fica fora do mapa', () => {
  const map = buildOrderIdMap([{ id: 'old-1', order_number: 101 }], []);
  assert.equal(map.size, 0);
});

test('conta a receber: passa a apontar para o pedido restaurado', () => {
  const map = buildOrderIdMap([{ id: 'old-1', order_number: 101 }], [{ id: 'new-1', order_number: 101 }]);
  const receivable = { id: 'r1', order_id: 'old-1', order_number: 101, total_amount: 100, status: 'aberta' };

  const remapped = remapOrderReference(receivable, map);

  assert.equal(remapped.order_id, 'new-1');
  assert.equal(remapped.order_number, 101, 'demais dados preservados');
  assert.equal(remapped.total_amount, 100);
});

test('operação CEASA: order_id e item_key reapontados, line_id preservado', () => {
  const map = buildOrderIdMap([{ id: 'old-1', order_number: 101 }], [{ id: 'new-1', order_number: 101 }]);
  const operation = { id: 'op1', order_id: 'old-1', line_id: 'abc', item_key: 'old-1:abc', box_name: 'Box 1', ceasa_value: 9 };

  const remapped = remapOrderReference(operation, map, { rebuildItemKey: true });

  assert.equal(remapped.order_id, 'new-1');
  assert.equal(remapped.item_key, 'new-1:abc');
  assert.equal(remapped.line_id, 'abc');
  assert.equal(remapped.box_name, 'Box 1', 'Box preservado');
  assert.equal(remapped.ceasa_value, 9, 'valor CEASA preservado');
});

test('sem correspondência: referência original mantida (dado não é perdido)', () => {
  const remapped = remapOrderReference({ order_id: 'desconhecido', line_id: 'abc', item_key: 'desconhecido:abc' }, new Map(), { rebuildItemKey: true });
  assert.equal(remapped.order_id, 'desconhecido');
  assert.equal(remapped.item_key, 'desconhecido:abc');
});

test('campos de controle não são recriados', () => {
  const restorable = toRestorable({ id: 'x', created_date: 'd', updated_date: 'u', created_by: 'u1', status: 'aberta' });
  assert.deepEqual(restorable, { status: 'aberta' });
});

test('resultado de criação: aceita lista, items ou records', () => {
  assert.deepEqual(collectionOf([{ id: 'a' }]), [{ id: 'a' }]);
  assert.deepEqual(collectionOf({ items: [{ id: 'b' }] }), [{ id: 'b' }]);
  assert.deepEqual(collectionOf({ records: [{ id: 'c' }] }), [{ id: 'c' }]);
  assert.deepEqual(collectionOf(undefined), []);
});