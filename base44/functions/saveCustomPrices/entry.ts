import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function withRetry(fn, retries = 6, baseDelay = 800) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.message?.includes('Rate limit') || err?.status === 429 || String(err).includes('429');
      if (isRateLimit && attempt < retries) {
        await delay(baseDelay * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { price_group_id, prices } = await req.json();
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
      const hasPrice = item.custom_price !== null && item.custom_price !== undefined;

      // Sem preço definido não existe relação PriceGroup + Product (nem promoção)
      if (!hasPrice) {
        if (existingEntry) toDelete.push(existingEntry.id);
        continue;
      }

      const isPromotion = item.is_promotion === true;

      if (existingEntry) {
        // Idempotente: só grava o que realmente mudou
        const patch = {};
        if (existingEntry.custom_price !== item.custom_price) patch.custom_price = item.custom_price;
        if ((existingEntry.is_promotion === true) !== isPromotion) patch.is_promotion = isPromotion;
        if (Object.keys(patch).length > 0) toUpdate.push({ id: existingEntry.id, patch });
      } else {
        toCreate.push({
          price_group_id,
          product_id: item.product_id,
          custom_price: item.custom_price,
          is_promotion: isPromotion
        });
      }
    }

    // Process one-by-one with retry on rate limit and gap between each
    for (const d of toCreate) {
      await withRetry(() => base44.asServiceRole.entities.CustomPrice.create(d));
      await delay(500);
    }

    for (const d of toUpdate) {
      await withRetry(() => base44.asServiceRole.entities.CustomPrice.update(d.id, d.patch));
      await delay(500);
    }

    for (const id of toDelete) {
      await withRetry(() => base44.asServiceRole.entities.CustomPrice.delete(id));
      await delay(500);
    }

    return Response.json({ success: true, created: toCreate.length, updated: toUpdate.length, deleted: toDelete.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});