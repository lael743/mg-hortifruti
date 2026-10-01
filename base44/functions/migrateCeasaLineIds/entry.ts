import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assignLineIds, itemKeyFor, legacyItemKey, syncCeasaFromOrder } from '../../shared/ceasaSync.js';
import { fetchAllPages } from '../../shared/pagination.js';

/**
 * Migração de identidade: order_id + item_key("order_id:indice") → order_id + line_id.
 *
 * 1. gera line_id em cada item de pedido que ainda não tem;
 * 2. migra as operações CEASA existentes pela chave legada (antes de gravar os
 *    pedidos, para que nenhuma sincronização disparada pelo workflow encontre
 *    operação sem identidade);
 * 3. sincroniza os pedidos com NF-e, deixando a base consistente.
 *
 * Preserva integralmente Box, valor CEASA, caminhão e observação. Idempotente.
 *
 * MODO SIMULAÇÃO POR PADRÃO: sem `dry_run: false` explícito a rotina apenas lê e
 * devolve o plano (quantos itens/operações seriam alterados), sem gravar nada.
 *
 * Leitura por cursor: a base inteira é percorrida em páginas, sem o corte
 * silencioso de uma única consulta.
 */
const CHUNK = 100;
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, retries = 5, baseDelay = 900) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isRateLimit = error?.status === 429
                || String(error?.message || '').includes('Rate limit')
                || String(error).includes('429');
            if (!isRateLimit || attempt === retries) throw error;
            await delay(baseDelay * (attempt + 1));
        }
    }
}

async function fetchAll(entityApi) {
    return fetchAllPages((cursor) => {
        const options = { sort: '-created_date', limit: PAGE_SIZE };
        if (cursor) options.cursor = cursor;
        return entityApi.list(options);
    }, MAX_PAGES);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const payload = await req.json().catch(() => ({}));
        const dryRun = payload.dry_run !== false;

        const service = base44.asServiceRole;
        const ordersResult = await fetchAll(service.entities.Order);
        const operationsResult = await fetchAll(service.entities.CeasaReportItem);
        const orders = ordersResult.items;
        const operations = operationsResult.items;

        // 1. Identidade dos itens dos pedidos + mapa da chave legada → line_id
        const legacyToLineId = new Map();
        const orderPatches = [];
        const ordersById = new Map();
        let itemsMigrated = 0;

        for (const order of orders) {
            const { items, changed, assigned } = assignLineIds(order.items || []);
            (items || []).forEach((item, index) => {
                legacyToLineId.set(legacyItemKey(order.id, index), item.line_id);
            });
            itemsMigrated += assigned.length;
            const migrated = { ...order, items };
            ordersById.set(order.id, migrated);
            if (changed) orderPatches.push({ id: order.id, items });
        }

        // 2a. Operações CEASA → line_id (grava antes dos pedidos)
        const opPatches = [];
        let alreadyMigrated = 0;
        let unresolved = 0;

        for (const op of operations) {
            if (!op.order_id) {
                unresolved++;
                continue;
            }
            if (op.line_id) {
                const normalized = itemKeyFor(op.order_id, op.line_id);
                if (op.item_key !== normalized) {
                    opPatches.push({ id: op.id, line_id: op.line_id, item_key: normalized });
                } else {
                    alreadyMigrated++;
                }
                continue;
            }
            if (!op.item_key) {
                unresolved++;
                continue;
            }
            const suffix = op.item_key.slice(String(op.order_id).length + 1);
            const lineId = legacyToLineId.get(op.item_key) || legacyToLineId.get(legacyItemKey(op.order_id, suffix));
            if (!lineId) {
                unresolved++;
                continue;
            }
            opPatches.push({ id: op.id, line_id: lineId, item_key: itemKeyFor(op.order_id, lineId) });
        }

        const ordersToSync = [...ordersById.values()].filter((order) => order.requires_nfe);

        if (dryRun) {
            console.log('[migrateCeasaLineIds] simulação', JSON.stringify({
                orders: orders.length,
                operations: operations.length,
                order_items_line_ids_generated: itemsMigrated,
                orders_should_update: orderPatches.length,
                operations_should_migrate: opPatches.length,
                orders_should_sync: ordersToSync.length,
            }));
            return Response.json({
                success: true,
                dry_run: true,
                executed: false,
                orders_scanned: orders.length,
                operations_scanned: operations.length,
                order_items_line_ids_generated: itemsMigrated,
                orders_should_update: orderPatches.length,
                operations_should_migrate: opPatches.length,
                operations_already_migrated: alreadyMigrated,
                operations_unresolved: unresolved,
                orders_should_sync: ordersToSync.length,
                truncated: ordersResult.truncated || operationsResult.truncated,
            });
        }

        let operationsMigrated = 0;
        for (let i = 0; i < opPatches.length; i += CHUNK) {
            const batch = opPatches.slice(i, i + CHUNK);
            await withRetry(() => service.entities.CeasaReportItem.bulkUpdate(batch));
            operationsMigrated += batch.length;
            await delay(300);
        }

        // 2b. Pedidos com a identidade gravada
        let ordersUpdated = 0;
        for (let i = 0; i < orderPatches.length; i += CHUNK) {
            const batch = orderPatches.slice(i, i + CHUNK);
            await withRetry(() => service.entities.Order.bulkUpdate(batch));
            ordersUpdated += batch.length;
            await delay(300);
        }

        // 3. Sincronização dos pedidos com NF-e
        const deps = {
            listOperations: async (id) => {
                const options = { sort: '-created_date', limit: PAGE_SIZE };
                const { items } = await fetchAllPages((cursor) => {
                    const pageOptions = cursor ? { ...options, cursor } : options;
                    return service.entities.CeasaReportItem.filter({ order_id: id }, pageOptions);
                });
                return items;
            },
            getOrder: (id) => service.entities.Order.get(id),
            updateOrderItems: (id, items) => service.entities.Order.update(id, { items }),
            createOperations: (records) => service.entities.CeasaReportItem.bulkCreate(records),
            updateOperations: (patches) => service.entities.CeasaReportItem.bulkUpdate(patches),
        };

        let ordersSynced = 0;
        let operationsCreated = 0;
        let operationsDeactivated = 0;
        const errors = [];

        for (const order of ordersToSync) {
            try {
                const res = await withRetry(() => syncCeasaFromOrder(order, deps));
                ordersSynced++;
                operationsCreated += res.created;
                operationsDeactivated += res.deactivated;
            } catch (error) {
                errors.push({ order_id: order.id, error: error.message });
            }
            await delay(350);
        }

        return Response.json({
            success: true,
            dry_run: false,
            executed: true,
            orders_scanned: orders.length,
            operations_scanned: operations.length,
            order_items_line_ids_generated: itemsMigrated,
            orders_updated: ordersUpdated,
            operations_migrated: operationsMigrated,
            operations_already_migrated: alreadyMigrated,
            operations_unresolved: unresolved,
            orders_synced: ordersSynced,
            operations_created: operationsCreated,
            operations_deactivated: operationsDeactivated,
            errors,
        });
    } catch (error) {
        console.error('Erro na migração de identidade CEASA:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});