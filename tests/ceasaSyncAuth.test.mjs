/**
 * Autorização do sincronizador CEASA (endpoint interno).
 *
 * Cobre os quatro casos exigidos: chamada anônima, usuário sem permissão,
 * administrador e chamada legítima do workflow — e garante que nenhuma
 * alteração futura volte a aceitar indicador de origem enviado no corpo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CEASA_SYNC_TOKEN,
  authorizeCeasaSync,
  hasValidSyncToken,
} from '../base44/shared/ceasaSyncAuth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(path.join(here, '..', relative), 'utf8');

const admin = { email: 'admin@mg.com', role: 'admin' };
const client = { email: 'cliente@mg.com', role: 'user' };

// 1. chamada anônima
test('anônimo sem credencial → 401', () => {
  const result = authorizeCeasaSync({ user: null, token: null });
  assert.deepEqual(result, { ok: false, status: 401, error: 'Unauthorized' });
});

test('anônimo com credencial errada → 401', () => {
  assert.equal(authorizeCeasaSync({ user: null, token: 'chute' }).status, 401);
  assert.equal(authorizeCeasaSync({ user: null, token: '' }).status, 401);
  assert.equal(authorizeCeasaSync({}).status, 401, 'sem token e sem sessão → 401');
});

test('anônimo com credencial de serviço → autorizado como workflow', () => {
  const result = authorizeCeasaSync({ user: null, token: CEASA_SYNC_TOKEN });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'workflow');
});

// 2. usuário sem permissão
test('usuário autenticado sem permissão → 403, mesmo com a credencial', () => {
  assert.equal(authorizeCeasaSync({ user: client, token: null }).status, 403);
  assert.equal(authorizeCeasaSync({ user: client, token: CEASA_SYNC_TOKEN }).status, 403);
});

// 3. administrador
test('administrador com credencial → autorizado, com origem registrada como admin', () => {
  const result = authorizeCeasaSync({ user: admin, token: CEASA_SYNC_TOKEN });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'admin');
});

test('administrador sem credencial → 401 (endpoint interno, não é rota de tela)', () => {
  assert.equal(authorizeCeasaSync({ user: admin, token: null }).status, 401);
});

// 4. workflow legítimo
test('workflow legítimo → autorizado e a credencial é a mesma nos dois lados', () => {
  const workflow = read('base44/workflows/ceasaSyncOnOrder.jsonc');
  assert.ok(workflow.includes(CEASA_SYNC_TOKEN), 'workflow envia a credencial da função');
  assert.match(workflow, /"function_name": "syncCeasaFromOrder"/);
  assert.equal(workflow.includes('invoked_by'), false, 'workflow não envia indicador de origem');
});

test('indicador de origem no corpo não autoriza ninguém', () => {
  // O corpo pode trazer qualquer coisa: a decisão não olha para ele.
  const spoofed = { user: null, token: null, invoked_by: 'workflow' };
  assert.equal(authorizeCeasaSync(spoofed).status, 401);
  assert.equal(authorizeCeasaSync({ user: client, token: null, invoked_by: 'workflow' }).status, 403);
});

test('a função não lê invoked_by e exige a credencial', () => {
  const source = read('base44/functions/syncCeasaFromOrder/entry.ts');
  assert.equal(/payload\.invoked_by/.test(source), false, 'não lê invoked_by do corpo');
  assert.match(source, /payload\.sync_token/, 'lê a credencial de serviço');
  assert.match(source, /authorizeCeasaSync\(/, 'autoriza pelo módulo de autorização');
  assert.match(source, /status: auth\.status/, 'responde 401/403 conforme a decisão');
});

test('comparação de credencial não aceita prefixo, sufixo nem tipo errado', () => {
  assert.equal(hasValidSyncToken(`${CEASA_SYNC_TOKEN}x`), false);
  assert.equal(hasValidSyncToken(CEASA_SYNC_TOKEN.slice(0, -1)), false);
  assert.equal(hasValidSyncToken(undefined), false);
  assert.equal(hasValidSyncToken(123), false);
  assert.equal(hasValidSyncToken(CEASA_SYNC_TOKEN), true);
});