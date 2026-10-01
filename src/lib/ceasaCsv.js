/**
 * Exportação CSV da Relação CEASA.
 *
 * Módulo puro (testável em tests/ceasaCsv.test.js).
 * - todos os campos textuais são citados, com aspas duplas escapadas e quebras
 *   de linha normalizadas (um produto com ";" ou quebra de linha não desloca
 *   colunas);
 * - BOM UTF-8 para acentuação correta em planilhas;
 * - total por Box e total geral, iguais aos exibidos na tela e na impressão;
 * - linhas sem Box permanecem no arquivo, rotuladas como "Sem Box".
 */

const SEP = ';';
const NEWLINE = '\r\n';
const SEM_BOX = 'Sem Box';

export const CSV_HEADERS = [
  'Box',
  'Cliente',
  'Pedido',
  'Produto',
  'Quantidade',
  'Valor CEASA',
  'Subtotal',
  'Caminhão',
  'Observação',
];

/** Campo citado e com escape — seguro para ";" , aspas e quebras de linha. */
export function csvCell(value) {
  const text = value == null ? '' : String(value).replace(/\r\n|\r|\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

const money = (value) => (Number(value) || 0).toFixed(2).replace('.', ',');

/**
 * Monta o CSV a partir das linhas do relatório.
 * rows: [{ box: {name} | null, cliente, orderNumber, produto, qtde, valorCeasa,
 *          subtotal, caminhao, obs }]
 */
export function buildCeasaCsv(rows = []) {
  const lines = [CSV_HEADERS.map(csvCell).join(SEP)];

  const groups = new Map();
  rows.forEach((row) => {
    const boxName = row.box?.name || SEM_BOX;
    if (!groups.has(boxName)) groups.set(boxName, []);
    groups.get(boxName).push(row);
  });

  let totalQty = 0;
  let totalValue = 0;

  [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .forEach(([boxName, boxRows]) => {
      boxRows.forEach((row) => {
        lines.push([
          boxName,
          row.cliente,
          row.orderNumber ?? '—',
          row.produto,
          row.qtde,
          money(row.valorCeasa),
          money(row.subtotal),
          row.caminhao,
          row.obs || '',
        ].map(csvCell).join(SEP));
      });

      const boxQty = boxRows.reduce((sum, row) => sum + (Number(row.qtde) || 0), 0);
      const boxValue = boxRows.reduce((sum, row) => sum + (Number(row.subtotal) || 0), 0);
      totalQty += boxQty;
      totalValue += boxValue;

      lines.push([
        `TOTAL DO BOX: ${boxName}`,
        `${boxRows.length} itens`,
        '',
        '',
        boxQty,
        '',
        money(boxValue),
        '',
        '',
      ].map(csvCell).join(SEP));
    });

  lines.push([
    'TOTAL GERAL',
    `${rows.length} itens`,
    '',
    '',
    totalQty,
    '',
    money(totalValue),
    '',
    '',
  ].map(csvCell).join(SEP));

  return '\uFEFF' + lines.join(NEWLINE);
}

/** Nome do arquivo do período exportado. */
export function ceasaCsvFileName(startDate, endDate) {
  return `relacao-ceasa-${startDate || 'inicio'}_a_${endDate || 'fim'}.csv`;
}