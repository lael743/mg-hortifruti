import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { walk_in_client_id, client_data, items, total, notes } = await req.json();

        if (!client_data?.full_name) {
            return Response.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
        }

        // Salva ou atualiza o WalkInClient
        let walkInClientId = walk_in_client_id;
        let clientName = client_data.full_name;
        let clientDisplayName = client_data.company_name || client_data.full_name;

        const clientPayload = {
            full_name: client_data.full_name,
            company_name: client_data.company_name || '',
            cnpj_cpf: client_data.cnpj_cpf || '',
            whatsapp: client_data.whatsapp || '',
            address: client_data.address || '',
            city: client_data.city || '',
            state: client_data.state || '',
            price_group_id: client_data.price_group_id || '',
            price_group_name: client_data.price_group_name || '',
            notes: client_data.notes || '',
        };

        if (walkInClientId) {
            // Atualiza cliente existente
            await base44.asServiceRole.entities.WalkInClient.update(walkInClientId, clientPayload);
        } else {
            // Cria novo cliente avulso
            const newClient = await base44.asServiceRole.entities.WalkInClient.create(clientPayload);
            walkInClientId = newClient.id;
        }

        // Gerar próximo número de pedido
        const lastOrders = await base44.asServiceRole.entities.Order.list('-order_number', 1);
        const nextOrderNumber = (lastOrders && lastOrders.length > 0 && lastOrders[0].order_number)
            ? lastOrders[0].order_number + 1
            : 1;

        // Email fictício único por cliente avulso para manter compatibilidade com a entidade Order
        const pseudoEmail = `avulso_${walkInClientId}@pedido.local`;

        const newOrder = await base44.asServiceRole.entities.Order.create({
            order_number: nextOrderNumber,
            customer_email: pseudoEmail,
            customer_name: clientName,
            customer_display_name: clientDisplayName,
            walk_in_client_id: walkInClientId,
            items: items,
            total: total,
            status: 'Confirmado',
            notes: notes || '',
        });

        // Criar registro de conta a receber
        await base44.asServiceRole.entities.ContasAReceber.create({
            order_id: newOrder.id,
            order_number: newOrder.order_number,
            customer_email: pseudoEmail,
            customer_name: clientDisplayName,
            total_amount: total,
            delivery_date: new Date().toISOString().split('T')[0],
            status: 'pendente_definicao',
            installments_count: 1,
            installment_interval_days: 30,
            installments: [],
        });

        return Response.json({ success: true, order: newOrder, walk_in_client_id: walkInClientId });
    } catch (error) {
        console.error('Error creating ad-hoc order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});