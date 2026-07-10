import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OWNER_EMAIL = 'centralgpsf@gmail.com';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, data } = body;
    const id = body.mensalidadeId || body.id;

    if (action === 'list') {
      const items = await base44.asServiceRole.entities.Mensalidade.list('-data_vencimento', 200);
      return Response.json({ items });
    }

    // All other actions require owner
    if (user.email !== OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'create') {
      const item = await base44.asServiceRole.entities.Mensalidade.create(data);
      return Response.json({ item });
    }

    if (action === 'update') {
      const item = await base44.asServiceRole.entities.Mensalidade.update(id, data);
      return Response.json({ item });
    }

    if (action === 'delete') {
      await base44.asServiceRole.entities.Mensalidade.delete(id);
      return Response.json({ ok: true });
    }

    if (action === 'markPaid') {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await base44.asServiceRole.entities.Mensalidade.get(id);
      await base44.asServiceRole.entities.Mensalidade.update(id, {
        status: 'paga',
        data_pagamento: today,
      });

      let proximaData = null;
      if (existing.recorrente) {
        const intervaloDias = existing.intervalo_dias || 30;
        proximaData = addDays(existing.data_vencimento, intervaloDias);
        const { id: _id, created_date: _cd, updated_date: _ud, created_by_id: _cbi, status: _s, data_pagamento: _dp, ...rest } = existing;
        await base44.asServiceRole.entities.Mensalidade.create({
          ...rest,
          data_vencimento: proximaData,
          status: 'pendente',
          data_pagamento: null,
        });
      }

      return Response.json({ ok: true, proxima: proximaData ? { data_vencimento: proximaData } : null });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});