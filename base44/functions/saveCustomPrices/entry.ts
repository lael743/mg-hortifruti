import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { price_group_id, prices } = await req.json();
    // prices: Array of { product_id, custom_price } — custom_price null means delete

    if (!price_group_id || !Array.isArray(prices)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch existing custom prices for this group
    const existing = await base44.asServiceRole.entities.CustomPrice.filter({ price_group_id });

    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];

    for (const item of prices) {
      const existingEntry = existing.find(e => e.product_id === item.product_id);
      if (item.custom_price === null || item.custom_price === undefined) {
        // Delete if exists
        if (existingEntry) toDelete.push(existingEntry.id);
      } else {
        if (existingEntry) {
          toUpdate.push({ id: existingEntry.id, custom_price: item.custom_price });
        } else {
          toCreate.push({ price_group_id, product_id: item.product_id, custom_price: item.custom_price });
        }
      }
    }

    // Process in small batches with delay to respect rate limits
    const delay = ms => new Promise(res => setTimeout(res, ms));
    const BATCH = 5;

    for (let i = 0; i < toCreate.length; i += BATCH) {
      await Promise.all(toCreate.slice(i, i + BATCH).map(d => base44.asServiceRole.entities.CustomPrice.create(d)));
      if (i + BATCH < toCreate.length) await delay(200);
    }

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      await Promise.all(toUpdate.slice(i, i + BATCH).map(d => base44.asServiceRole.entities.CustomPrice.update(d.id, { custom_price: d.custom_price })));
      if (i + BATCH < toUpdate.length) await delay(200);
    }

    for (let i = 0; i < toDelete.length; i += BATCH) {
      await Promise.all(toDelete.slice(i, i + BATCH).map(id => base44.asServiceRole.entities.CustomPrice.delete(id)));
      if (i + BATCH < toDelete.length) await delay(200);
    }

    return Response.json({ success: true, created: toCreate.length, updated: toUpdate.length, deleted: toDelete.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});