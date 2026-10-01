import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  operationKey,
  toItems,
  operationsForLine,
  pickOperation,
  indexOperationsByLine,
  fetchAllOperations,
} from '../src/lib/ceasaOperations.js';

const ORDER = 'ord-1';
const OTHER_ORDER = 'ord-2';
const LINE = 'line-a';
const OTHER_LINE = 'line-b';

const op = (over = {}) => ({
  id: over.id || `op-${Math.random().toString(36).slice(2, 8)}`,
  order_id: ORDER,
  line_id: LINE,
  box_id: '',
  box_name: '',
  ceasa_value: 0,
  caminhao: '',
  notes: '',
  active: true,
  created_date: '2026-09-01T10:00:00.000000',
  ...over,
});

// ---------------------------------------------------------------------------
// Identidade: order_id + line_id (nunca a posição no array)
// ---------------------------------------------------------------------------
test('identidade: a chave é order_id:line_id', () => {
  assert.equal(operationKey(ORDER, LINE), `${ORDER}:${LINE}`);
  assert.equal(operationKey(ORDER, null), null);
  assert.equal(operationKey(null, LINE), null);
});

test('identidade: operações de linhas diferentes não se misturam', () => {
  const ops = [
    op({ id: 'da-linha-a', line_id: LINE, box_name: 'Box A' }),
    op({ id: 'da-linha-b', line_id: OTHER_LINE, box_name: 'Box B' }),
    op({ id: 'sem-linha', line_id: null, box_name: 'Box Sem Linha' }),
    op({ id: 'de-outro-pedido', order_id: OTHER_ORDER, box_name: 'Box Outro Pedido' }),
  ];

  const daLinhaA = operationsForLine(ops, ORDER, LINE);
  assert.deepEqual(daLinhaA.map(o => o.id), ['da-linha-a']);

  const daLinhaB = operationsForLine(ops, ORDER, OTHER_LINE);
  assert.deepEqual(daLinhaB.map(o => o.id), ['da-linha-b']);

  // Mesmo line_id em outro pedido é outra linha
  assert.equal(pickOperation(operationsForLine(ops, OTHER_ORDER, LINE)).id, 'de-outro-pedido');

  // Operações sem identidade não pertencem a nenhuma linha
  assert.equal(pickOperation(operationsForLine(ops, ORDER, null)), null);
});

// ---------------------------------------------------------------------------
// Resolução canônica: a mais recente ATIVA
// ---------------------------------------------------------------------------
test('pickOperation: a operação mais recente ativa vence', () => {
  const ops = [
    op({ id: 'antiga', created_date: '2026-09-01T10:00:00.000000', box_name: 'Box Antigo' }),
    op({ id: 'recente', created_date: '2026-09-02T10:00:00.000000', box_name: 'Box Novo' }),
  ];
  assert.equal(pickOperation(ops).id, 'recente');
  assert.equal(pickOperation([...ops].reverse()).id, 'recente', 'ordem de entrada não importa');
});

test('pickOperation: ignora operação inativa quando existe ativa, mesmo mais nova', () => {
  const ops = [
    op({ id: 'ativa', created_date: '2026-09-01T10:00:00.000000', box_name: 'Box Ativo' }),
    op({ id: 'inativa-recente', created_date: '2026-09-03T10:00:00.000000', active: false, box_name: 'Box Inativo' }),
  ];
  assert.equal(pickOperation(ops).id, 'ativa');
});

test('pickOperation: sem nenhuma ativa, devolve a mais recente', () => {
  const ops = [
    op({ id: 'inativa-antiga', created_date: '2026-09-01T10:00:00.000000', active: false }),
    op({ id: 'inativa-recente', created_date: '2026-09-04T10:00:00.000000', active: false }),
  ];
  assert.equal(pickOperation(ops).id, 'inativa-recente');
});

test('pickOperation: sem operações devolve null', () => {
  assert.equal(pickOperation([]), null);
  assert.equal(pickOperation(null), null);
});

// ---------------------------------------------------------------------------
// REGRESSÃO do defeito relatado: leitura e gravação precisam apontar para o
// MESMO registro — senão o Box salvo some da tela.
// ---------------------------------------------------------------------------
test('regressão: leitura e gravação resolvem a mesma operação (Box exibido = Box gravado)', () => {
  const ops = [
    op({ id: 'box-salvo', box_name: 'UNIFLOR', ceasa_value: 118, created_date: '2026-09-01T10:00:00.000000' }),
    op({ id: 'duplicata-antiga', box_name: 'CANTU', created_date: '2026-08-30T10:00:00.000000' }),
    op({ id: 'inativa-recente', box_name: 'GABY', active: false, created_date: '2026-09-05T10:00:00.000000' }),
  ];

  // leitura da Gestão (índice montado a partir das operações carregadas)
  const exibida = indexOperationsByLine(ops)[operationKey(ORDER, LINE)];
  // alvo da gravação (salvar a linha / aplicar em massa / aplicar caminhão)
  const alvoDaGravacao = pickOperation(operationsForLine(ops, ORDER, LINE));

  assert.equal(exibida.id, alvoDaGravacao.id, 'exibição e gravação apontam para o mesmo registro');
  assert.equal(exibida.box_name, 'UNIFLOR');
});

test('regressão: operação fora da primeira página continua sendo encontrada', async () => {
  // 600 operações de pedidos/linhas distintas + a operação que interessa na ÚLTIMA página
  const outras = Array.from({ length: 600 }, (_, i) =>
    op({ id: `outra-${i}`, order_id: `ord-${i}`, line_id: `line-${i}`, box_name: 'Outro' })
  );
  const interesse = op({ id: 'op-interesse', order_id: 'ord-alvo', line_id: 'line-alvo', box_name: 'UNIFLOR', created_date: '2020-01-01T00:00:00.000000' });

  const pages = [];
  for (let i = 0; i < outras.length; i += 250) pages.push(outras.slice(i, i + 250));
  pages.push([interesse]); // última página

  let chamadas = 0;
  const carregadas = await fetchAllOperations(async (cursor) => {
    const pagina = cursor ? Number(cursor) : 0;
    chamadas++;
    const items = pages[pagina] || [];
    return { items, next_cursor: String(pagina + 1), has_more: pagina < pages.length - 1 };
  });

  assert.equal(carregadas.length, 601, 'todas as páginas foram percorridas');
  assert.equal(chamadas, 4);

  const exibida = indexOperationsByLine(carregadas)[operationKey('ord-alvo', 'line-alvo')];
  assert.equal(exibida?.box_name, 'UNIFLOR', 'o Box salvo fora da primeira página é carregado');
});

test('fetchAllOperations: para quando não há mais páginas e não entra em laço', async () => {
  let chamadas = 0;
  const vazio = await fetchAllOperations(async () => {
    chamadas++;
    return { items: [], next_cursor: null, has_more: false };
  });
  assert.deepEqual(vazio, []);
  assert.equal(chamadas, 1);

  // cursor inválido repetido é interrompido pelo teto de páginas
  const travado = await fetchAllOperations(async () => ({ items: [op({})], next_cursor: 'x', has_more: true }), 3);
  assert.equal(travado.length, 3);
});

test('toItems: aceita página do SDK, array e ausência de dados', () => {
  assert.deepEqual(toItems({ items: [1, 2] }), [1, 2]);
  assert.deepEqual(toItems([1, 2]), [1, 2]);
  assert.deepEqual(toItems(null), []);
  assert.deepEqual(toItems(undefined), []);
});

// ---------------------------------------------------------------------------
// Campos operacionais nunca são trocados entre operações distintas
// ---------------------------------------------------------------------------
test('índice preserva Box, valor CEASA, caminhão e observação da linha', () => {
  const ops = [
    op({ id: 'a', box_id: 'box-1', box_name: 'Box 1', ceasa_value: 95, caminhao: 'Caminhão 1', notes: 'conferido' }),
    op({ id: 'b', line_id: OTHER_LINE, box_id: 'box-2', box_name: 'Box 2', ceasa_value: 130, caminhao: 'Caminhão 2', notes: 'x' }),
  ];
  const index = indexOperationsByLine(ops);
  const a = index[operationKey(ORDER, LINE)];
  const b = index[operationKey(ORDER, OTHER_LINE)];

  assert.deepEqual(
    [a.box_id, a.box_name, a.ceasa_value, a.caminhao, a.notes],
    ['box-1', 'Box 1', 95, 'Caminhão 1', 'conferido']
  );
  assert.deepEqual(
    [b.box_id, b.box_name, b.ceasa_value, b.caminhao, b.notes],
    ['box-2', 'Box 2', 130, 'Caminhão 2', 'x']
  );
});