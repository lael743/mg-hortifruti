import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { syncCeasaFromOrder } from '../../shared/ceasaSync.js';

/**
 * Sincroniza as operações CEASA de um pedido.
 *
 * Executado no backend, disparado automaticamente pelo workflow de entidade
 * (Order create/update) — não depende da Gestão CEASA nem do frontend.
 *
 * Chamado pelo workflow não há usuário na requisição; quando houver, exige admin.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json().catch(() => ({}));
        const orderId = payload.order_id || payload.entity_id || payload.data?.id;

        let user = null;
        try {
            user = await base44.auth.me();
        } catch {
            user = null;
        }
        if (user && user.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
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
            listOperations: (id) => service.entities.CeasaReportItem.filter({ order_id: id }, '-created_date', 500),
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