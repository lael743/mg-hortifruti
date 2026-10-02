/**
 * Valor CEASA: leitura do campo, zero como valor definido e destaque de divergência.
 *
 * O campo aceita "0", "0.00" e "0,00" — zero é valor DEFINIDO (nunca ausência de
 * preenchimento) e apenas campo vazio significa "valor não definido".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayCeasaValue,
  effectiveNfeValue,
  effectiveUnitPrice,
  formatCeasaMoney,
  initialCeasaValueOf,
  isCeasaValueDivergent,
  isCeasaValueZero,
  parseCeasaValueInput,
} from '../src/lib/ceasaValue.js';

const op = (over = {}) => ({ id: 'op1', active: true, ...over });
const item = (over = {}) => ({ final_unit_price: 15, unit_price: 15, ...over });

test('parse: aceita zero nas três grafias', () => {
  assert.equal(parseCeasaValueInput('0'), 0);
  assert.equal(parseCeasaValueInput('0.00'), 0);
  assert.equal(parseCeasaValueInput('0,00'), 0);
  assert.equal(parseCeasaValueInput(' 0 '), 0);
});

test('parse: valores positivos em ponto e vírgula', () => {
  assert.equal(parseCeasaValueInput('15'), 15);
  assert.equal(parseCeasaValueInput('15.50'), 15.5);
  assert.equal(parseCeasaValueInput('15,50'), 15.5);
  assert.equal(parseCeasaValueInput('1.234,56'), 1234.56);
});

test('parse: campo vazio ou texto inválido = valor não definido (nunca 0 por ausência)', () => {
  assert.equal(parseCeasaValueInput(''), null);
  assert.equal(parseCeasaValueInput('   '), null);
  assert.equal(parseCeasaValueInput(null), null);
  assert.equal(parseCeasaValueInput(undefined), null);
  assert.equal(parseCeasaValueInput('abc'), null);
});

test('parse: não aplica mínimo maior que zero (nem bloqueia zero)', () => {
  assert.equal(parseCeasaValueInput('0'), 0);
  assert.equal(parseCeasaValueInput('-3'), -3);
});

test('zero é valor definido: exibido como 0, não como ausência', () => {
  assert.equal(displayCeasaValue(op({ ceasa_value: 0 }), item()), 0);
  assert.equal(formatCeasaMoney(displayCeasaValue(op({ ceasa_value: 0 }), item())), '0,00');
});

test('zero definido não cai para o preço do pedido, mas "não definido" cai', () => {
  assert.equal(displayCeasaValue(op({ ceasa_value: 0 }), item()), 0, 'zero não é substituído pelo preço');
  assert.equal(displayCeasaValue(op({}), item()), 15, 'ausente usa o preço efetivo do item');
  assert.equal(displayCeasaValue(op({ ceasa_value: 12 }), item()), 12);
});

test('isCeasaValueZero: só quando o operador definiu zero', () => {
  assert.equal(isCeasaValueZero(op({ ceasa_value: 0 })), true);
  assert.equal(isCeasaValueZero(op({ ceasa_value: 0.0 })), true);
  assert.equal(isCeasaValueZero(op({ ceasa_value: 15 })), false);
  assert.equal(isCeasaValueZero(op({})), false, 'sem valor definido não é zero definido');
  assert.equal(isCeasaValueZero(null), false);
});

test('isCeasaValueDivergent: compara com o preço do pedido apenas como referência', () => {
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 0 }), item()), true, 'zero x R$ 15,00 diverge');
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 12 }), item()), true);
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 15 }), item()), false, 'igual ao pedido = normal');
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 15.004 }), item()), false, 'diferença de centavo é arredondamento');
  assert.equal(isCeasaValueDivergent(op({}), item()), false, 'sem valor definido não há divergência');
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 0 }), item({ final_unit_price: 0, unit_price: 0 })), false);
});

test('referência visual usa o valor do pedido (meia nota) e nunca alimenta o CEASA', () => {
  const comMeiaNota = item({ final_unit_price: 15, nfe_value: 7.5 });
  assert.equal(effectiveNfeValue(comMeiaNota), 7.5, 'coluna "Valor pedido"');
  assert.equal(isCeasaValueDivergent(op({ ceasa_value: 15 }), comMeiaNota), true);
  assert.equal(effectiveUnitPrice(comMeiaNota), 15, 'preço comercial do item');
  assert.equal(initialCeasaValueOf(comMeiaNota), 15, 'valor inicial não usa o valor fiscal');
});

test('formatação monetária: zero como 0,00 na tela, igual ao CSV e à impressão', () => {
  assert.equal(formatCeasaMoney(0), '0,00');
  assert.equal(formatCeasaMoney(15), '15,00');
  assert.equal(formatCeasaMoney(1234.5), '1234,50');
  assert.equal(formatCeasaMoney(undefined), '0,00');
  assert.equal(formatCeasaMoney(null), '0,00');
});