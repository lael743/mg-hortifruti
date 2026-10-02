/**
 * Ajuste em lote dos valores CEASA (meia nota e percentual personalizado).
 *
 * Cenários cobertos (ver também a validação de fluxo na prévia):
 *  1. redução de 5% em todos os itens do pedido;
 *  2. meia nota (50%);
 *  3. ajuste somente nos itens selecionados;
 *  4. valores CEASA zerados permanecem zero (e item sem valor não é ajustado);
 *  5. o plano carrega apenas identidade e valor — nada comercial ou logístico;
 *  6. isolamento entre clientes e pedidos (nada sai do pedido informado);
 *  8. a sincronização CEASA nunca sobrescreve o valor ajustado;
 *  9. cancelar (não confirmar) não grava: a prévia é pura e não altera entradas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCeasaBatchPreview,
  isValidAdjustPercent,
  MEIA_NOTA_PERCENT,
} from '../src/lib/ceasaBatchAdjust.js';
import { reduceCeasaValue, roundCeasaMoney } from '../src/lib/ceasaValue.js';
import { buildSyncPlan } from '../base44/shared/ceasaSync.js';

/** Linha da Gestão CEASA — mesmo formato de AdminCeasaReport#flatRows. */
const linha = (over = {}) => ({
  orderId: 'pedido-1',
  orderNumber: 999001,
  lineId: 'l1',
  produto: 'Tomate',
  qtde: 10,
  valorUn: 20,
  cliente: 'Cliente A',
  caminhao: 'Caminhão 1',
  box: { id: 'box-1', name: 'Box 01' },
  operation: {
    id: 'op-1',
    order_id: 'pedido-1',
    line_id: 'l1',
    active: true,
    box_id: 'box-1',
    box_name: 'Box 01',
    caminhao: 'Caminhão 1',
    notes: 'conferido',
    ceasa_value: 20,
  },
  ...over,
});

const todos = (linhas) => linhas.map(l => l.lineId);

test('percentual válido: maior que zero e até 100%', () => {
  assert.equal(isValidAdjustPercent(5), true);
  assert.equal(isValidAdjustPercent(50), true);
  assert.equal(isValidAdjustPercent(100), true);
  assert.equal(isValidAdjustPercent(0), false);
  assert.equal(isValidAdjustPercent(-5), false);
  assert.equal(isValidAdjustPercent(101), false);
  assert.equal(isValidAdjustPercent(null), false);
  assert.equal(isValidAdjustPercent('abc'), false);
});

test('arredondamento monetário: duas casas, meio centavo para cima', () => {
  assert.equal(roundCeasaMoney(14.249999999999998), 14.25);
  assert.equal(reduceCeasaValue(20, 5), 19, '20 − 5% = 19');
  assert.equal(reduceCeasaValue(7.5, 5), 7.13, '7,5 − 5% = 7,125 → 7,13');
  assert.equal(reduceCeasaValue(0.01, 50), 0.01, 'um centavo nunca desaparece sozinho');
  assert.equal(reduceCeasaValue(15, 0), 15, 'percentual 0 não altera');
});

test('1. redução de 5% em todos os itens de um cliente', () => {
  const linhas = [
    linha({ lineId: 'l1', operation: { ...linha().operation, id: 'op-1', line_id: 'l1', ceasa_value: 20 } }),
    linha({ lineId: 'l2', produto: 'Cebola', operation: { ...linha().operation, id: 'op-2', line_id: 'l2', ceasa_value: 7.5 } }),
  ];
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', 5, todos(linhas));

  assert.equal(preview.ajustes.length, 2);
  assert.deepEqual(preview.ajustes.map(a => a.para), [19, 7.13]);
  assert.equal(preview.totalAnterior, 27.5);
  assert.equal(preview.totalNovo, 26.13);
  assert.equal(preview.linhas.every(l => l.ajustavel && l.marcado), true);
});

test('2. meia nota (50%) reduz os valores pela metade', () => {
  const linhas = [linha({ lineId: 'l1', operation: { ...linha().operation, ceasa_value: 20 } })];
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', MEIA_NOTA_PERCENT, todos(linhas));

  assert.equal(preview.ajustes.length, 1);
  assert.equal(preview.ajustes[0].de, 20);
  assert.equal(preview.ajustes[0].para, 10);
  assert.equal(preview.totalAnterior, 20);
  assert.equal(preview.totalNovo, 10);
});

test('3. ajuste somente nos itens selecionados', () => {
  const linhas = [
    linha({ lineId: 'l1', operation: { ...linha().operation, id: 'op-1', line_id: 'l1', ceasa_value: 20 } }),
    linha({ lineId: 'l2', produto: 'Cebola', operation: { ...linha().operation, id: 'op-2', line_id: 'l2', ceasa_value: 10 } }),
    linha({ lineId: 'l3', produto: 'Batata', operation: { ...linha().operation, id: 'op-3', line_id: 'l3', ceasa_value: 8 } }),
  ];
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', 10, ['l1', 'l3']);

  assert.deepEqual(preview.ajustes.map(a => a.lineId), ['l1', 'l3']);
  assert.deepEqual(preview.ajustes.map(a => a.para), [18, 7.2]);
  assert.equal(preview.linhas.find(l => l.lineId === 'l2').marcado, false);
  assert.equal(preview.linhas.find(l => l.lineId === 'l2').valorNovo, 10, 'não selecionado permanece igual');
  assert.equal(preview.totalAnterior, 28, 'total só dos selecionados');
});

test('4. valores zerados permanecem zero e item sem valor não é ajustado', () => {
  const linhas = [
    linha({ lineId: 'l1', operation: { ...linha().operation, id: 'op-1', line_id: 'l1', ceasa_value: 0 } }),
    linha({ lineId: 'l2', produto: 'Sem valor', operation: { id: 'op-2', order_id: 'pedido-1', line_id: 'l2', active: true } }),
    linha({ lineId: 'l3', produto: 'Sem operação', operation: null }),
    linha({ lineId: 'l4', produto: 'Couve', operation: { ...linha().operation, id: 'op-4', line_id: 'l4', ceasa_value: 12 } }),
  ];
  // O zero é marcado de propósito: mesmo assim não pode ser ajustado.
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', 50, ['l1', 'l2', 'l3', 'l4']);

  assert.deepEqual(preview.ajustes.map(a => a.lineId), ['l4']);
  const zero = preview.linhas.find(l => l.lineId === 'l1');
  assert.equal(zero.ajustavel, false);
  assert.equal(zero.motivo, 'zero');
  assert.equal(zero.valorAtual, 0);
  assert.equal(zero.valorNovo, 0, 'zero continua zero');
  assert.equal(preview.linhas.find(l => l.lineId === 'l2').motivo, 'sem-valor');
  assert.equal(preview.linhas.find(l => l.lineId === 'l3').motivo, 'sem-operacao');
  assert.equal(preview.totalAnterior, 12);
  assert.equal(preview.totalNovo, 6);
});

test('percentual inválido não ajusta nada (nem monta plano)', () => {
  const linhas = [linha({ lineId: 'l1', operation: { ...linha().operation, ceasa_value: 20 } })];
  [null, '', 'abc', 0, 101].forEach(invalido => {
    const preview = buildCeasaBatchPreview(linhas, 'pedido-1', invalido, ['l1']);
    assert.equal(preview.ajustes.length, 0, `percentual ${invalido}`);
    assert.equal(preview.linhas[0].valorNovo, 20, `valor mantido com percentual ${invalido}`);
    // Sem percentual válido ainda é possível conferir o total dos itens marcados.
    assert.equal(preview.selecionados, 1, `itens marcados com percentual ${invalido}`);
    assert.equal(preview.totalAnterior, 20);
    assert.equal(preview.totalNovo, 20, 'novo total acompanha o anterior sem percentual');
  });
});

test('5. plano carrega apenas identidade e valor: nada comercial ou logístico', () => {
  const linhas = [
    linha({ lineId: 'l1', operation: { ...linha().operation, id: 'op-1', line_id: 'l1', ceasa_value: 20 } }),
  ];
  const antes = JSON.parse(JSON.stringify(linhas));
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', 50, ['l1']);

  assert.deepEqual(Object.keys(preview.ajustes[0]).sort(), ['de', 'lineId', 'orderId', 'para', 'produto']);
  assert.deepEqual(linhas, antes, 'a prévia não altera as linhas recebidas');
  const operationKeys = Object.keys(preview.ajustes[0]);
  ['qtde', 'valorUn', 'caminhao', 'box', 'box_id', 'notes', 'quantity'].forEach(k => {
    assert.equal(operationKeys.includes(k), false, `${k} não entra no plano`);
  });
});

test('6. isolamento: nada de outro pedido ou de outro cliente entra no ajuste', () => {
  const linhas = [
    linha({ lineId: 'l1', operation: { ...linha().operation, id: 'op-1', line_id: 'l1', ceasa_value: 20 } }),
    linha({
      orderId: 'pedido-2',
      orderNumber: 999002,
      cliente: 'Cliente B',
      lineId: 'l2',
      produto: 'Tomate do vizinho',
      operation: { id: 'op-2', order_id: 'pedido-2', line_id: 'l2', active: true, ceasa_value: 30 },
    }),
  ];
  const preview = buildCeasaBatchPreview(linhas, 'pedido-1', 50, ['l1', 'l2']);

  assert.deepEqual(preview.linhas.map(l => l.lineId), ['l1']);
  assert.deepEqual(preview.ajustes.map(a => a.lineId), ['l1']);
  assert.deepEqual(preview.ajustes.map(a => a.orderId), ['pedido-1']);
  assert.equal(preview.totalNovo, 10, 'o item do outro pedido não entra no total');
  assert.equal(linhas[1].operation.ceasa_value, 30, 'operação de outro pedido intacta');
});

test('8. sincronização CEASA não sobrescreve o valor ajustado', () => {
  const pedido = {
    id: 'pedido-1',
    requires_nfe: true,
    items: [{ line_id: 'l1', product_id: 'p1', product_name: 'Tomate', quantity: 10, final_unit_price: 20 }],
  };
  const operacao = {
    id: 'op-1',
    order_id: 'pedido-1',
    line_id: 'l1',
    active: true,
    box_id: 'box-1',
    box_name: 'Box 01',
    caminhao: 'Caminhão 1',
    notes: 'conferido',
    ceasa_value: 10, // valor já ajustado (meia nota)
    created_date: '2026-10-02T10:00:00.000000',
  };

  const plan = buildSyncPlan(pedido, [operacao]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, 'op-1');
  assert.equal('ceasa_value' in plan.updates[0], false, 'a sincronização nunca escreve ceasa_value');
  ['box_id', 'box_name', 'caminhao', 'notes'].forEach(k => {
    assert.equal(k in plan.updates[0], false, `a sincronização preserva ${k}`);
  });
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.deactivate.length, 0);

  // Aplicando o plano, o valor ajustado continua igual.
  const depois = { ...operacao, ...plan.updates[0] };
  assert.equal(depois.ceasa_value, 10, 'valor ajustado preservado pela sincronização');
  assert.equal(depois.caminhao, 'Caminhão 1');
});