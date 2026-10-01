import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { syncCeasaFromOrder } from '../../shared/ceasaSync.js';
import { fetchAllPages } from '../../shared/pagination.js';

/**
 * Sincroniza as operações CEASA de um pedido.
 *
 * Executado no backend, disparado automaticamente pelo workflow de entidade
 * (Order create/update) — não depende da Gestão CEASA nem do frontend.
 *
 * Acesso: admin autenticado (Gestão/manutenção) ou chamada do workflow
 * (`invoked_by: "workflow"`, o único outro contexto que a plataforma usa para
 * executar esta função). Toda invocação é registrada em log com a origem.
 *
 * Leitura de operações por página (cursor): um pedido com muitas operações não
 * pode ter parte delas ignorada na sincronização.
 *
 * A sincronização NUNCA grava valor CEASA, Box, caminhão ou observação — apenas
 * campos originados do pedido (produto, quantidade, cliente, data, NF-e) e as
 * identidades de linha. Pedido, total comercial e financeiro ficam intactos:
 * do pedido, a função só grava `line_id` quando falta.
 */
const ORDER_PAGE_SIZE = 500;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json().catch(() => ({}));
        const orderId = payload.order_id || payload.entity_id || payload.data?.id;
        const invokedBy = payload.invoked_by || null;

        let user = null;
        try {
            user = await base44.auth.me();
        } catch {
            user = null;
        }

        const origin = req.headers.get('origin') || req.headers.get('referer') || '-';
        console.log('[syncCeasaFromOrder]', JSON.stringify({
            order_id: orderId || null,
            invoked_by: invokedBy,
            user: user ? user.email : null,
            origin,
        }));

        if (user) {
            if (user.role !== 'admin') {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (invokedBy !== 'workflow') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!orderId) {
            return Response.json({ error: 'order_id é obrigatório' }, { status: 400 });
        }

        const service = base44.asServiceRole;
        let order = null;
        try {
            order = await service.entities.Order.get(orderId);
        } catch {
            order = null;
        }
        if (!order) {
            return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
        }

        const result = await syncCeasaFromOrder(order, {
            listOperations: async (id) => {
                const options = { sort: '-created_date', limit: ORDER_PAGE_SIZE };
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
        });

        return Response.json({ success: true, ...result });
    } catch (error) {
        console.error('Erro na sincronização CEASA:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});