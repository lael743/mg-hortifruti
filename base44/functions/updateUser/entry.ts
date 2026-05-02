import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, data } = await req.json();

    if (!userId || !data) {
      return Response.json({ error: 'userId e data são obrigatórios' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.User.update(userId, data);

    return Response.json({ success: true, user: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});