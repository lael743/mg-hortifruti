import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todos os clientes: usuários cadastrados (diretos) + clientes avulsos
    const [registeredUsers, walkInClients] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.WalkInClient.list(),
    ]);

    // Mapeia usuários cadastrados para formato de cliente
    const directClients = registeredUsers.map(u => ({
      id: u.id,
      full_name: u.full_name || u.contact_name || '',
      company_name: u.company_name || '',
      cnpj_cpf: u.cnpj || '',
      whatsapp: u.whatsapp || u.phone || '',
      address: u.address || '',
      city: u.city || '',
      state: u.state || '',
      email: u.email,
      price_group_id: u.price_group_id || '',
      price_group_name: '',
      client_type: 'direct',
    }));

    // Mapeia clientes avulsos
    const adHocClients = walkInClients.map(c => ({
      id: c.id,
      full_name: c.full_name || '',
      company_name: c.company_name || '',
      cnpj_cpf: c.cnpj_cpf || '',
      whatsapp: c.whatsapp || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      email: null,
      price_group_id: c.price_group_id || '',
      price_group_name: c.price_group_name || '',
      client_type: 'walk_in',
    }));

    const allClients = [...directClients, ...adHocClients];

    return Response.json({ clients: allClients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});