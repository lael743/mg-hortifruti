/**
 * Paginação por cursor (módulo puro, sem SDK).
 *
 * Nenhuma leitura do módulo CEASA pode truncar em silêncio: as funções abaixo
 * percorrem todas as páginas e informam quando um teto de segurança foi atingido
 * (`truncated`), para que a origem exiba um aviso explícito.
 *
 * Espelhado no frontend em src/lib/pagination.js (o diretório base44/ não é
 * empacotado no bundle do cliente).
 */

export function toItems(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.items || [];
}

/**
 * Percorre todas as páginas de uma consulta com cursor.
 * fetchPage(cursor) devolve { items, next_cursor, has_more }.
 * Retorna { items, truncated } — truncated = true quando o teto de páginas foi
 * atingido com páginas ainda pendentes.
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