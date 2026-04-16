import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!data) {
      return Response.json({ ok: true, skipped: true });
    }

    let title = '';
    let message = '';
    let type = '';

    if (event.type === 'create') {
      type = 'new_order';
      title = `🛒 Novo pedido #${data.order_number || ''}`;
      message = `${data.customer_name || data.customer_email} fez um novo pedido no valor de R$ ${(data.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } else if (event.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = data?.status;

      if (!oldStatus || oldStatus === newStatus) {
        return Response.json({ ok: true, skipped: true });
      }

      type = 'order_updated';
      title = `📦 Pedido #${data.order_number || ''} atualizado`;
      message = `Status de "${oldStatus}" → "${newStatus}" — Cliente: ${data.customer_name || data.customer_email}`;
    } else {
      return Response.json({ ok: true, skipped: true });
    }

    await base44.asServiceRole.entities.AdminNotification.create({
      title,
      message,
      type,
      order_id: event.entity_id,
      order_number: data.order_number || null,
      read: false,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});