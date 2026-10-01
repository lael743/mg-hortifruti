/**
 * Paginação por cursor no frontend.
 *
 * A plataforma limita cada consulta a uma página. Ler apenas a primeira página
 * escondia registros (por exemplo, pedidos antigos fora dos 500 mais recentes e
 * operações CEASA de períodos anteriores). As funções abaixo percorrem todas as
 * páginas e informam quando um teto de segurança foi atingido, para que a tela
 * possa avisar em vez de cortar em silêncio.
 */

export function toItems(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.items || [];
}

/**
 * Percorre todas as páginas de uma consulta com cursor.
 * fetchPage(cursor) devolve { items, next_cursor, has_more }.
 * Retorna { items, truncated }.
 */
export async function fetchAllPages(fetchPage, maxPages = 200) {
  const items = [];
  let cursor = null;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    items.push(...toItems(result));
    if (!result || result.has_more !== true || !result.next_cursor) {
      return { items, truncated: false };
    }
    cursor = result.next_cursor;
  }

  return { items, truncated: true };
}

/**
 * Lê uma entidade inteira (sem filtro), página a página.
 * Retorna { items, truncated }.
 */
export async function listAllPages(entityApi, { sort = '-created_date', pageSize = 500, maxRecords = 20000 } = {}) {
  return fetchAllPages(async (cursor) => {
    const options = { sort, limit: pageSize };
    if (cursor) options.cursor = cursor;
    return entityApi.list(options);
  }, Math.max(1, Math.ceil(maxRecords / pageSize)));
}

/**
 * Lê uma consulta filtrada inteira, página a página.
 * Retorna { items, truncated }.
 */
export async function filterAllPages(entityApi, query, { sort = '-created_date', pageSize = 500, maxRecords = 20000 } = {}) {
  return fetchAllPages(async (cursor) => {
    const options = { sort, limit: pageSize };
    if (cursor) options.cursor = cursor;
    return entityApi.filter(query, options);
  }, Math.max(1, Math.ceil(maxRecords / pageSize)));
}