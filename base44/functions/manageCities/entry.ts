import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { action } = await req.json();

    if (action === 'seed') {
      // Coleta todas as cidades existentes em WalkInClient e User
      const [walkInClients, users] = await Promise.all([
        base44.asServiceRole.entities.WalkInClient.list(),
        base44.asServiceRole.entities.User.list(),
      ]);

      const citySet = new Map();
      const addCity = (name, state) => {
        if (!name || !name.trim()) return;
        const key = name.trim().toLowerCase();
        if (!citySet.has(key)) {
          citySet.set(key, { name: name.trim(), state: (state || '').toUpperCase() });
        }
      };

      walkInClients.forEach(c => addCity(c.city, c.state));
      users.forEach(u => addCity(u.city, u.state));

      // Busca cidades já cadastradas para não duplicar
      const existing = await base44.asServiceRole.entities.City.list();
      const existingKeys = new Set(existing.map(c => (c.name || '').toLowerCase()));

      const toCreate = [];
      citySet.forEach((city) => {
        if (!existingKeys.has(city.name.toLowerCase())) {
          toCreate.push(city);
        }
      });

      if (toCreate.length > 0) {
        await base44.asServiceRole.entities.City.bulkCreate(toCreate);
      }

      return Response.json({
        success: true,
        seeded: toCreate.length,
        total: existing.length + toCreate.length,
      });
    }

    if (action === 'rename') {
      const { city_id, new_name, new_state } = await req.json();
      if (!city_id || !new_name || !new_name.trim()) {
        return Response.json({ error: 'ID da cidade e novo nome são obrigatórios' }, { status: 400 });
      }

      const oldCity = await base44.asServiceRole.entities.City.get(city_id);
      if (!oldCity) {
        return Response.json({ error: 'Cidade não encontrada' }, { status: 404 });
      }

      const oldName = oldCity.name;
      const oldState = oldCity.state || '';
      const updatedName = new_name.trim();
      const updatedState = (new_state || oldState).toUpperCase();

      // Atualiza a cidade
      await base44.asServiceRole.entities.City.update(city_id, {
        name: updatedName,
        state: updatedState,
      });

      // Atualiza WalkInClients que usam o nome antigo
      const walkInToUpdate = await base44.asServiceRole.entities.WalkInClient.filter({ city: oldName });
      let walkInUpdated = 0;
      if (walkInToUpdate.length > 0) {
        await base44.asServiceRole.entities.WalkInClient.updateMany(
          { city: oldName },
          { $set: { city: updatedName, state: updatedState || oldState } }
        );
        walkInUpdated = walkInToUpdate.length;
      }

      // Atualiza Users que usam o nome antigo
      const usersToUpdate = await base44.asServiceRole.entities.User.filter({ city: oldName });
      let usersUpdated = 0;
      if (usersToUpdate.length > 0) {
        for (const u of usersToUpdate) {
          await base44.asServiceRole.entities.User.update(u.id, {
            city: updatedName,
            state: updatedState || u.state || oldState,
          });
        }
        usersUpdated = usersToUpdate.length;
      }

      // Atualiza Orders que usam o nome antigo no customer_name ou items
      const ordersToUpdate = await base44.asServiceRole.entities.Order.filter({});
      let ordersUpdated = 0;
      for (const o of ordersToUpdate) {
        if (o.customer_name && o.customer_name.includes(oldName)) {
          // Não alteramos nomes de clientes nos pedidos — a cidade é do cliente, não do pedido
        }
      }

      return Response.json({
        success: true,
        renamed_from: oldName,
        renamed_to: updatedName,
        walk_in_updated: walkInUpdated,
        users_updated: usersUpdated,
        orders_updated: ordersUpdated,
      });
    }

    if (action === 'merge') {
      const { source_city_id, target_city_id } = await req.json();
      if (!source_city_id || !target_city_id || source_city_id === target_city_id) {
        return Response.json({ error: 'Cidade de origem e destino são obrigatórias e devem ser diferentes' }, { status: 400 });
      }

      const sourceCity = await base44.asServiceRole.entities.City.get(source_city_id);
      const targetCity = await base44.asServiceRole.entities.City.get(target_city_id);
      if (!sourceCity || !targetCity) {
        return Response.json({ error: 'Cidade não encontrada' }, { status: 404 });
      }

      const oldName = sourceCity.name;
      const newName = targetCity.name;
      const newState = targetCity.state || '';

      // Atualiza WalkInClients
      const walkInToUpdate = await base44.asServiceRole.entities.WalkInClient.filter({ city: oldName });
      if (walkInToUpdate.length > 0) {
        await base44.asServiceRole.entities.WalkInClient.updateMany(
          { city: oldName },
          { $set: { city: newName, state: newState } }
        );
      }

      // Atualiza Users
      const usersToUpdate = await base44.asServiceRole.entities.User.filter({ city: oldName });
      for (const u of usersToUpdate) {
        await base44.asServiceRole.entities.User.update(u.id, {
          city: newName,
          state: newState || u.state || '',
        });
      }

      // Remove a cidade de origem
      await base44.asServiceRole.entities.City.delete(source_city_id);

      return Response.json({
        success: true,
        merged_from: oldName,
        merged_to: newName,
        walk_in_updated: walkInToUpdate.length,
        users_updated: usersToUpdate.length,
      });
    }

    return Response.json({ error: 'Ação inválida. Use: seed, rename, merge' }, { status: 400 });
  } catch (error) {
    console.error('Error managing cities:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});