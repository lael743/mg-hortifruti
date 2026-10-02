/**
 * Exportação CSV da Relação CEASA: escape de caracteres, BOM e totais.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCeasaCsv, csvCell, ceasaCsvFileName } from '../src/lib/ceasaCsv.js';

const row = (over = {}) => ({
  box: { id: 'b1', name: 'Box 1' },
  cliente: 'Cliente A',
  orderNumber: 10,
  produto: 'Tomate',
  qtde: 2,
  valorCeasa: 50,
  subtotal: 100,
  caminhao: 'Caminhão 1',
  obs: '',
  ...over,
});

test('csvCell: cita o campo e escapa aspas', () => {
  assert.equal(csvCell('Tomate'), '"Tomate"');
  assert.equal(csvCell('Caixa "especial"'), '"Caixa ""especial"""');
  assert.equal(csvCell(null), '""');
});

test('csvCell: ponto e vírgula e quebra de linha não deslocam colunas', () => {
  assert.equal(csvCell('Alface; crespa'), '"Alface; crespa"');
  assert.equal(csvCell('Linha 1\nLinha 2'), '"Linha 1 Linha 2"');
  assert.equal(csvCell('Linha 1\r\nLinha 2'), '"Linha 1 Linha 2"');
});

test('csv: BOM UTF-8 e cabeçalho citado', () => {
  const csv = buildCeasaCsv([row()]);
  assert.ok(csv.startsWith('\uFEFF'), 'BOM presente');
  assert.ok(csv.includes('"Box";"Cliente";"Pedido";"Produto";"Quantidade";"Valor CEASA";"Subtotal";"Caminhão";"Observação"'));
});

test('csv: total por Box e total geral com os mesmos valores da tela', () => {
  const rows = [
    row({ produto: 'Tomate', qtde: 2, valorCeasa: 50, subtotal: 100 }),
    row({ produto: 'Alface', qtde: 3, valorCeasa: 10, subtotal: 30 }),
    row({ box: { id: 'b2', name: 'Box 2' }, produto: 'Cenoura', qtde: 1, valorCeasa: 20, subtotal: 20 }),
  ];

  const csv = buildCeasaCsv(rows);

  assert.ok(csv.includes('"TOTAL DO BOX: Box 1";"2 itens";"";"";"5";"";"130,00"'), 'subtotal do Box 1');
  assert.ok(csv.includes('"TOTAL DO BOX: Box 2";"1 itens";"";"";"1";"";"20,00"'), 'subtotal do Box 2');
  assert.ok(csv.includes('"TOTAL GERAL";"3 itens";"";"";"6";"";"150,00"'), 'total geral');
});

test('csv: linhas sem Box permanecem no arquivo, rotuladas', () => {
  const csv = buildCeasaCsv([row({ box: null, produto: 'Sem box' })]);
  assert.ok(csv.includes('"Sem Box"'), 'rótulo presente');
  assert.ok(csv.includes('"Sem box"'), 'linha presente');
  assert.ok(csv.includes('"TOTAL DO BOX: Sem Box"'));
});

test('csv: acentos preservados e vírgula decimal nos valores', () => {
  const csv = buildCeasaCsv([row({ produto: 'Maçã Fuji', cliente: 'João Conceição', subtotal: 1234.5 })]);
  assert.ok(csv.includes('"Maçã Fuji"'));
  assert.ok(csv.includes('"João Conceição"'));
  assert.ok(csv.includes('"1234,50"'));
});

test('csv: nome do arquivo por período', () => {
  assert.equal(ceasaCsvFileName('2026-10-01', '2026-10-05'), 'relacao-ceasa-2026-10-01_a_2026-10-05.csv');
});

test('csv: valor CEASA zero é exportado como 0,00 e o item permanece no arquivo', () => {
  const csv = buildCeasaCsv([row({ produto: 'Tomate', qtde: 2, valorCeasa: 0, subtotal: 0 })]);

  assert.ok(csv.includes('"Tomate"'), 'item com valor zero não é excluído');
  assert.ok(csv.includes('"0,00"'), 'zero exportado como 0,00');
  assert.ok(csv.includes('"TOTAL DO BOX: Box 1";"1 itens";"";"";"2";"";"0,00"'), 'total do Box zerado');
  assert.ok(csv.includes('"TOTAL GERAL";"1 itens";"";"";"2";"";"0,00"'), 'total geral zerado');
});