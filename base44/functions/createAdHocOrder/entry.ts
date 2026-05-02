import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { customer_id, customer_email, customer_name, items, total, notes, client_data } = await req.json();

        let clientEmail = customer_email;
        let clientName = customer_name;

        // Sempre salva/atualiza dados do cliente para histórico e futuras impressões
        if (client_data && client_data.email) {
            const existingUsers = await base44.asServiceRole.entities.User.filter({ email: client_data.email });

            if (existingUsers && existingUsers.length > 0) {
                const existing = existingUsers[0];
                // Atualiza dados do cliente (sobrescreve com os dados fornecidos se preenchidos)
                const updateData = {};
                if (client_data.company_name) updateData.company_name = client_data.company_name;
                if (client_data.cnpj_cpf) updateData.cnpj_cpf = client_data.cnpj_cpf;
                if (client_data.whatsapp) updateData.whatsapp = client_data.whatsapp;
                if (client_data.address) updateData.address = client_data.address;
                if (client_data.city) updateData.city = client_data.city;
                if (client_data.state) updateData.state = client_data.state;
                if (client_data.price_group_id) updateData.price_group_id = client_data.price_group_id;
                if (client_data.price_group_name) updateData.price_group_name = client_data.price_group_name;
                if (Object.keys(updateData).length > 0) {
                    await base44.asServiceRole.entities.User.update(existing.id, updateData);
                }
                clientEmail = existing.email;
                clientName = client_data.full_name || existing.full_name;
            } else {
                // Criar novo usuário ad-hoc (sem senha, só dados para histórico)
                const newUser = await base44.asServiceRole.entities.User.create({
                    full_name: client_data.full_name,
                    email: client_data.email,
                    role: 'user',
                    status: 'approved',
                    company_name: client_data.company_name || '',
                    cnpj_cpf: client_data.cnpj_cpf || '',
                    whatsapp: client_data.whatsapp || '',
                    address: client_data.address || '',
                    city: client_data.city || '',
                    state: client_data.state || '',
                    price_group_id: client_data.price_group_id || '',
                    price_group_name: client_data.price_group_name || '',
                });
                clientEmail = newUser.email;
                clientName = newUser.full_name;
            }
        }

        // Gerar próximo número de pedido
        const lastOrders = await base44.asServiceRole.entities.Order.list('-order_number', 1);
        const nextOrderNumber = (lastOrders && lastOrders.length > 0 && lastOrders[0].order_number)
            ? lastOrders[0].order_number + 1
            : 1;

        const newOrder = await base44.asServiceRole.entities.Order.create({
            order_number: nextOrderNumber,
            customer_email: clientEmail,
            customer_name: clientName,
            items: items,
            total: total,
            status: 'Confirmado',
            notes: notes || '',
        });

        // Criar registro de conta a receber
        await base44.asServiceRole.entities.ContasAReceber.create({
            order_id: newOrder.id,
            order_number: newOrder.order_number,
            customer_email: clientEmail,
            customer_name: clientName,
            total_amount: total,
            delivery_date: new Date().toISOString().split('T')[0],
            status: 'pendente_definicao',
            installments_count: 1,
            installment_interval_days: 30,
            installments: [],
        });

        return Response.json({ success: true, order: newOrder });
    } catch (error) {
        console.error('Error creating ad-hoc order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});