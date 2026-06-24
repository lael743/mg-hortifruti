import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }

        const { walk_in_client_id, client_type, client_data, items, total, notes } = await req.json();

        if (!client_data?.full_name) {
            return Response.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
        }

        let customerEmail;
        let customerName = client_data.full_name;
        let customerDisplayName = client_data.company_name || client_data.full_name;
        let finalWalkInClientId = walk_in_client_id || null;

        if (client_type === 'direct' && client_data.email) {
            // Cliente direto (usuário cadastrado) — usa o email real
            customerEmail = client_data.email;
            finalWalkInClientId = null;
        } else if (client_type === 'walk_in' || (!client_type && walk_in_client_id)) {
            // Cliente avulso — salva/atualiza WalkInClient
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

            if (walk_in_client_id) {
                await base44.asServiceRole.entities.WalkInClient.update(walk_in_client_id, clientPayload);
            } else {
                const newClient = await base44.asServiceRole.entities.WalkInClient.create(clientPayload);
                finalWalkInClientId = newClient.id;
            }

            customerEmail = `avulso_${finalWalkInClientId}@pedido.local`;
        } else {
            // Novo cliente avulso sem ID prévio
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

            const newClient = await base44.asServiceRole.entities.WalkInClient.create(clientPayload);
            finalWalkInClientId = newClient.id;
            customerEmail = `avulso_${finalWalkInClientId}@pedido.local`;
        }

        // Gerar próximo número de pedido
        const lastOrders = await base44.asServiceRole.entities.Order.list('-order_number', 1);
        const nextOrderNumber = (lastOrders && lastOrders.length > 0 && lastOrders[0].order_number)
            ? lastOrders[0].order_number + 1
            : 1;

        const newOrder = await base44.asServiceRole.entities.Order.create({
            order_number: nextOrderNumber,
            customer_email: customerEmail,
            customer_name: customerName,
            customer_display_name: customerDisplayName,
            walk_in_client_id: finalWalkInClientId,
            items: items,
            total: total,
            status: 'Confirmado',
            notes: notes || '',
        });

        // Criar registro de conta a receber
        await base44.asServiceRole.entities.ContasAReceber.create({
            order_id: newOrder.id,
            order_number: newOrder.order_number,
            customer_email: customerEmail,
            customer_name: customerDisplayName,
            total_amount: total,
            delivery_date: new Date().toISOString().split('T')[0],
            status: 'pendente_definicao',
            installments_count: 1,
            installment_interval_days: 30,
            installments: [],
        });

        return Response.json({ success: true, order: newOrder, walk_in_client_id: finalWalkInClientId });
    } catch (error) {
        console.error('Error creating ad-hoc order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});