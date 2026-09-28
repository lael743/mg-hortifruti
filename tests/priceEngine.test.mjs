/**
 * Testes do priceEngine + flag de promoção por tabela (PriceGroup + Product).
 * Rodar com: npm test   (node --test tests/)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomPriceMap,
  isAvailableInPriceGroup,
  resolvePrice,
} from '../src/lib/priceEngine.js';
import { buildPriceTableHtml } from '../src/lib/printPriceTable.js';

const groupA = { id: 'ga', name: 'Tabela A', type: 'custom' };
const groupB = { id: 'gb', name: 'Tabela B', type: 'custom' };
const pctGroup = { id: 'gp', name: 'Atacado', type: 'percentage', discount_percent: 10 };

const tomate = { id: 'p1', name: 'Tomate', price: 100, packaging_type: 'Caixa', weight: '20kg', active: true };
const alface = { id: 'p2', name: 'Alface', price: 50, promo_active: true, promo_price: 40, packaging_type: 'Unidade', active: true };

const tomatePromoA = { id: 'c1', price_group_id: 'ga', product_id: 'p1', custom_price: 80, is_promotion: true };
const tomateNormalB = { id: 'c2', price_group_id: 'gb', product_id: 'p1', custom_price: 90, is_promotion: false };

const company = { company_name: 'MG Hortifruti' };
const printFor = (priceGroup, customPrices, products = [tomate]) =>
  buildPriceTableHtml({ products, priceGroup, customPrices, clientOrders: [], company });

test('produto normal: preço da tabela, sem promoção', () => {
  const r = resolvePrice(tomate, groupA, tomateNormalB);
  assert.equal(r.price, 90);
  assert.equal(r.isPromotion, false);
  assert.equal(r.hasDefinedPrice, true);
});

test('produto marcado como promoção: preço resolvido não muda, flag liga', () => {
  const semPromo = resolvePrice(tomate, groupA, { ...tomatePromoA, is_promotion: false });
  const comPromo = resolvePrice(tomate, groupA, tomatePromoA);
  assert.equal(comPromo.price, 80);
  assert.equal(semPromo.price, comPromo.price, 'marcar promoção não pode alterar o preço');
  assert.equal(comPromo.isPromotion, true);
});

test('desmarcar promoção mantém o preço e desliga a flag', () => {
  const marcado = resolvePrice(tomate, groupA, tomatePromoA);
  const desmarcado = resolvePrice(tomate, groupA, { ...tomatePromoA, is_promotion: false });
  assert.equal(desmarcado.price, marcado.price);
  assert.equal(desmarcado.isPromotion, false);
});

test('mesmo produto: promoção em uma tabela e normal em outra', () => {
  const mapA = buildCustomPriceMap([tomatePromoA]);
  const mapB = buildCustomPriceMap([tomateNormalB]);
  assert.equal(resolvePrice(tomate, groupA, mapA.p1).isPromotion, true);
  assert.equal(resolvePrice(tomate, groupB, mapB.p1).isPromotion, false);
  // preço de cada tabela permanece independente
  assert.equal(resolvePrice(tomate, groupA, mapA.p1).price, 80);
  assert.equal(resolvePrice(tomate, groupB, mapB.p1).price, 90);
});

test('cliente vinculado à tabela recebe is_promotion apenas na sua tabela', () => {
  const mapA = buildCustomPriceMap([tomatePromoA]);
  const clienteNaTabelaA = resolvePrice(tomate, groupA, mapA.p1);
  assert.equal(clienteNaTabelaA.isPromotion, true);
  assert.equal(clienteNaTabelaA.price, 80);
  // fora de tabela por produto (percentual) a flag não se aplica
  assert.equal(resolvePrice(tomate, pctGroup, tomatePromoA).isPromotion, false);
  assert.equal(resolvePrice(tomate, null, tomatePromoA).isPromotion, false);
});

test('preço continua idêntico antes/depois da marcação em qualquer tipo de tabela', () => {
  assert.equal(resolvePrice(tomate, groupA, tomatePromoA).price, resolvePrice(tomate, groupA, { ...tomatePromoA, is_promotion: false }).price);
  assert.ok(Math.abs(resolvePrice(alface, pctGroup, undefined).price - 36) < 1e-9, 'tabela percentual: 40 - 10% = 36');
  assert.ok(Math.abs(resolvePrice(alface, null, undefined).price - 40) < 1e-9, 'sem tabela: promoção global do produto');
});

test('impressão: promoção da tabela sai sem valor riscado e com fonte destacada', () => {
  const html = printFor(groupA, [tomatePromoA]);
  assert.match(html, /R\$ 80\.00/);
  assert.match(html, /font-size:9px;">R\$ 80\.00/);
  assert.match(html, /PROMO/);
  assert.doesNotMatch(html, /line-through/, 'promoção da tabela não deve mostrar o valor original riscado');
});

test('impressão: produto sem promoção na tabela segue o layout padrão', () => {
  const html = printFor(groupB, [tomateNormalB]);
  assert.match(html, /R\$ 90\.00/);
  assert.doesNotMatch(html, /font-size:9px;">R\$ 90\.00/);
  assert.doesNotMatch(html, /line-through/);
});

test('impressão: promoção global do produto continua mostrando o valor riscado', () => {
  const html = printFor(pctGroup, [], [alface]);
  assert.match(html, /line-through/);
  assert.match(html, /PROMO/);
});

test('impressão: produto sem preço definido na tabela não aparece', () => {
  const html = printFor(groupA, [tomatePromoA], [tomate, alface]);
  assert.match(html, /Tomate/);
  assert.doesNotMatch(html, /Alface/);
});

test('catálogo: só produto com preço definido participa da tabela por produto', () => {
  assert.equal(isAvailableInPriceGroup(groupA, tomatePromoA), true);
  assert.equal(isAvailableInPriceGroup(groupA, undefined), false, 'sem CustomPrice não entra no catálogo do cliente');
  assert.equal(isAvailableInPriceGroup(groupB, { product_id: 'p1', custom_price: null }), false);
  assert.equal(isAvailableInPriceGroup(pctGroup, undefined), true, 'tabela percentual mantém o fallback atual');
  assert.equal(isAvailableInPriceGroup(null, undefined), true, 'sem tabela mantém o catálogo atual');
});

test('priceEngine é pura: não altera produto, relação nem pedidos históricos', () => {
  const product = { ...tomate };
  const entry = { ...tomatePromoA };
  const order = { id: 'o1', items: [{ product_id: 'p1', quantity: 2, unit_price: 80, final_unit_price: 80 }] };
  const before = JSON.stringify({ product, entry, order });

  resolvePrice(product, groupA, entry);
  buildPriceTableHtml({ products: [product], priceGroup: groupA, customPrices: [entry], clientOrders: [order], company });

  assert.equal(JSON.stringify({ product, entry, order }), before);
});