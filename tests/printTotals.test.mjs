/**
 * Rodapé dos pedidos impressos: volume, peso total e valor.
 *
 * O peso total é a soma de quantidade x peso da embalagem, com gramas
 * convertidas para quilo. Itens sem peso numérico não entram na soma.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcTotalVolume,
  calcTotalWeight,
  parseWeightKg,
  formatWeight,
  buildVolumeWeightLabel,
} from '../src/lib/printTotals.js';

const pedido = [
  { quantity: 10, weight: '20kg' },
  { quantity: 5, weight: '7,5 kg' },
  { quantity: 2, weight: '500g' },
];

test('volume é a soma das quantidades', () => {
  assert.equal(calcTotalVolume(pedido), 17);
  assert.equal(calcTotalVolume([]), 0);
  assert.equal(calcTotalVolume(undefined), 0);
});

test('lê o peso da embalagem em quilo', () => {
  assert.equal(parseWeightKg('20kg'), 20);
  assert.equal(parseWeightKg('20 kg'), 20);
  assert.equal(parseWeightKg('1,5 kg'), 1.5);
  assert.equal(parseWeightKg('1.5kg'), 1.5);
  assert.equal(parseWeightKg('500g'), 0.5);
  assert.equal(parseWeightKg('500 g'), 0.5);
  assert.equal(parseWeightKg('20'), 20); // sem unidade assume quilo
  assert.equal(parseWeightKg('un'), 0); // unidade não é peso
  assert.equal(parseWeightKg(''), 0);
  assert.equal(parseWeightKg(null), 0);
});

test('peso total multiplica pela quantidade', () => {
  // 10 x 20kg + 5 x 7,5kg + 2 x 0,5kg = 200 + 37,5 + 1 = 238,5
  assert.equal(calcTotalWeight(pedido), 238.5);
  assert.equal(calcTotalWeight([{ quantity: 3, weight: '1kg' }]), 3);
  assert.equal(calcTotalWeight([{ quantity: 3, weight: 'un' }]), 0);
  assert.equal(calcTotalWeight([]), 0);
});

test('formata o peso no padrão brasileiro', () => {
  assert.equal(formatWeight(238.5), '238,5 kg');
  assert.equal(formatWeight(1200), '1.200 kg');
  assert.equal(formatWeight(0.75), '0,75 kg');
});

test('rótulo do rodapé mostra volume e peso', () => {
  assert.equal(buildVolumeWeightLabel(pedido), '17 vol.<br/>238,5 kg');
  // Pedido sem peso conhecido: só o volume, como antes
  assert.equal(buildVolumeWeightLabel([{ quantity: 4, weight: 'un' }]), '4 vol.');
  assert.equal(buildVolumeWeightLabel([{ quantity: 4 }]), '4 vol.');
  assert.equal(buildVolumeWeightLabel([]), '0 vol.');
});

test('peso total considera apenas o peso conhecido de cada item', () => {
  const misto = [
    { quantity: 2, weight: '10kg' },
    { quantity: 3, weight: 'un' },
    { quantity: 1, weight: '250g' },
  ];
  assert.equal(calcTotalWeight(misto), 20.25); // 20kg + 0 + 0,25kg
  assert.equal(buildVolumeWeightLabel(misto), '6 vol.<br/>20,25 kg');
});