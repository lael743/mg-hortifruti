import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderItemIdentity,
  removeProductFromOrder,
  isOrderEligibleForBulkItemRemoval,
} from '../src/lib/bulkRemoveOrderItem.js';

test('remove one product line and preserve other real order items', () => {
  const order = {
    items: [
      { product_id: 'p1', product_name: 'Tomate', quantity: 2, unit_price: 10 },
      { product_id: 'p2', product_name: 'Batata', quantity: 3, unit_price: 5 },
    ],
    discount_type: 'percent',
    discount_value: 10,
  };
  const result = removeProductFromOrder(order, 'id:p1');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].product_id, 'p2');
  assert.equal(result.subtotal, 15);
  assert.equal(result.discount_amount, 1.5);
  assert.equal(result.total, 13.5);
});

test('fixed discount is capped by the new subtotal and bonus items stay outside subtotal', () => {
  const order = {
    items: [
      { product_id: 'p1', quantity: 1, unit_price: 100 },
      { product_id: 'p2', quantity: 2, unit_price: 10 },
      { product_id: 'bonus', quantity: 1, unit_price: 0, is_bonus: true },
    ],
    discount_type: 'value',
    discount_value: 50,
  };
  const result = removeProductFromOrder(order, 'id:p1');
  assert.equal(result.subtotal, 20);
  assert.equal(result.discount_amount, 20);
  assert.equal(result.discount_value, 50);
  assert.equal(result.total, 0);
  assert.equal(result.items.length, 2);
});

test('matches by stable product id and falls back to normalized product name', () => {
  assert.equal(orderItemIdentity({ product_id: 'abc', product_name: 'Tomate' }), 'id:abc');
  assert.equal(orderItemIdentity({ product_name: '  TOMATE  ' }), 'name:tomate');
});

test('delivered and cancelled orders are protected from bulk item removal', () => {
  assert.equal(isOrderEligibleForBulkItemRemoval({ status: 'Pendente' }), true);
  assert.equal(isOrderEligibleForBulkItemRemoval({ status: 'Confirmado' }), true);
  assert.equal(isOrderEligibleForBulkItemRemoval({ status: 'Entregue' }), false);
  assert.equal(isOrderEligibleForBulkItemRemoval({ status: 'Cancelado' }), false);
});
