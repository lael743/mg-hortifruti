/**
 * Autorização do sincronizador CEASA (módulo puro, sem SDK — testável).
 *
 * O sincronizador é um endpoint INTERNO: quem o chama é o workflow de entidade
 * da plataforma. Nenhuma tela o invoca (a Gestão CEASA grava direto nas
 * entidades), então a autorização não depende de nada que o chamador declare
 * sobre si mesmo.
 *
 * Regras (nesta ordem):
 *  1. sessão de usuário identificada que não seja admin → 403;
 *  2. sem a credencial de serviço válida → 401 (chamada externa anônima não
 *     aciona a sincronização, mesmo que envie `invoked_by` ou qualquer outro
 *     indicador de origem no corpo — o corpo da requisição é do chamador);
 *  3. credencial válida → autorizado (workflow, ou admin em manutenção).
 *
 * A credencial vive apenas do lado servidor (esta pasta `base44/` nunca entra no
 * bundle do navegador e o workflow é configuração de servidor). O valor precisa
 * ser idêntico ao enviado em `base44/workflows/ceasaSyncOnOrder.jsonc` — a
 * igualdade é verificada por tests/ceasaSyncAuth.test.mjs.
 */
export const CEASA_SYNC_TOKEN = 'mgh_ceasa_sync_7f3a91c4e08d5621b45ad9e7';

/** Comparação sem retorno antecipado (não vaza o segredo por tempo de resposta). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function hasValidSyncToken(provided) {
  return safeEqual(provided, CEASA_SYNC_TOKEN);
}

/**
 * Decide a autorização de uma requisição do sincronizador.
 * Devolve { ok: true, source } ou { ok: false, status, error }.
 */
export function authorizeCeasaSync({ user = null, token = null } = {}) {
  if (user && user.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  if (!hasValidSyncToken(token)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, status: 200, source: user ? 'admin' : 'workflow' };
}