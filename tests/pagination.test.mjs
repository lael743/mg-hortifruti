/**
 * Paginação por cursor: nenhuma leitura pode truncar em silêncio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages, listAllPages, filterAllPages, toItems } from '../src/lib/pagination.js';

const makePages = (sizes) => {
  const pages = sizes.map((size, pageIndex) =>
    Array.from({ length: size }, (_, i) => ({ id: `r${pageIndex}-${i}` }))
  );
  const totalPages = pages.length;
  return async (cursor) => {
    const index = cursor ? Number(cursor) : 0;
    return {
      items: pages[index] || [],
      next_cursor: String(index + 1),
      has_more: index < totalPages - 1,
    };
  };
};

test('fetchAllPages: percorre todas as páginas', async () => {
  const { items, truncated } = await fetchAllPages(makePages([500, 500, 137]));
  assert.equal(items.length, 1137);
  assert.equal(truncated, false);
});

test('fetchAllPages: última página parcial e lista vazia', async () => {
  assert.equal((await fetchAllPages(makePages([3]))).items.length, 3);
  assert.deepEqual((await fetchAllPages(async () => ({ items: [], next_cursor: null, has_more: false }))).items, []);
});

test('fetchAllPages: teto de páginas devolve truncated em vez de cortar em silêncio', async () => {
  const { items, truncated } = await fetchAllPages(makePages([2, 2, 2, 2]), 2);
  assert.equal(items.length, 4);
  assert.equal(truncated, true);
});

test('fetchAllPages: cursor travado é interrompido pelo teto', async () => {
  const { items, truncated } = await fetchAllPages(async () => ({ items: [{ id: 'x' }], next_cursor: 'x', has_more: true }), 3);
  assert.equal(items.length, 3);
  assert.equal(truncated, true);
});

test('listAllPages: usa a opção de cursor e sinaliza o teto de registros', async () => {
  const calls = [];
  const entityApi = {
    list: async (options) => {
      calls.push(options);
      const index = options.cursor ? Number(options.cursor) : 0;
      return { items: [{ id: `r${index}` }], next_cursor: String(index + 1), has_more: index < 3 };
    },
  };

  const { items, truncated } = await listAllPages(entityApi, { pageSize: 1, maxRecords: 2 });

  assert.equal(items.length, 2);
  assert.equal(truncated, true);
  assert.equal(calls[0].sort, '-created_date');
  assert.equal(calls[0].cursor, undefined, 'primeira chamada sem cursor');
  assert.equal(calls[1].cursor, '1', 'chamadas seguintes com o cursor devolvido');
});

test('filterAllPages: mantém o filtro em todas as páginas', async () => {
  const queries = [];
  const entityApi = {
    filter: async (query, options) => {
      queries.push({ query, options });
      const index = options.cursor ? Number(options.cursor) : 0;
      return { items: [{ id: `r${index}` }], next_cursor: String(index + 1), has_more: index < 1 };
    },
  };

  const { items } = await filterAllPages(entityApi, { order_id: 'o1' });

  assert.equal(items.length, 2);
  assert.deepEqual(queries.map(q => q.query), [{ order_id: 'o1' }, { order_id: 'o1' }]);
});

test('toItems: aceita página do SDK, array e ausência de dados', () => {
  assert.deepEqual(toItems({ items: [1, 2] }), [1, 2]);
  assert.deepEqual(toItems([1]), [1]);
  assert.deepEqual(toItems(null), []);
});