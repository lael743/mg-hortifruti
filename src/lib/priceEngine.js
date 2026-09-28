/**
 * priceEngine — fonte única de resolução de preço do app.
 *
 * Regras (idênticas às que já existiam nos consumidores, apenas centralizadas):
 *  - Sem tabela vinculada ......... preço base (promoção global do produto, se ativa)
 *  - Tabela percentual ............ preço base * (1 - discount_percent / 100)
 *  - Tabela por produto (custom) .. preço da relação PriceGroup + Product
 *
 * `is_promotion` é uma flag comercial/visual da relação PriceGroup + Product.
 * Ela NÃO altera o preço: apenas acompanha o preço resolvido, e só existe
 * quando o produto tem preço definido naquela tabela.
 *
 * Consumidores: Catalog, ProductCard, ProductRecommendations, printPriceTable,
 * LoadTemplateDialog.
 */

/** Aceita o registro da relação ({ custom_price, is_promotion }) ou o número (mapa legado). */
export function getCustomPriceValue(entry) {
  if (entry === undefined || entry === null) return undefined;
  if (typeof entry === 'number') return entry;
  return entry.custom_price ?? undefined;
}

/** Preço efetivamente definido na relação PriceGroup + Product? */
export function hasDefinedCustomPrice(entry) {
  const value = getCustomPriceValue(entry);
  return value !== undefined && value !== null;
}

export function isCustomPromotion(entry) {
  return hasDefinedCustomPrice(entry) && entry?.is_promotion === true;
}

/** Mapa product_id -> registro de CustomPrice. */
export function buildCustomPriceMap(customPrices) {
  return Object.fromEntries((customPrices || []).map((cp) => [cp.product_id, cp]));
}

/**
 * Produto participa da tabela do cliente?
 * Em tabela por produto, só entra quem tem preço definido nela (sem fallback).
 */
export function isAvailableInPriceGroup(priceGroup, entry) {
  if (priceGroup?.type !== 'custom') return true;
  return hasDefinedCustomPrice(entry);
}

/** Resolve preço + estado de promoção de um produto em uma tabela. */
export function resolvePrice(product, priceGroup, entry) {
  const isCustomTable = priceGroup?.type === 'custom';
  const discount = priceGroup?.discount_percent || 0;
  const basePrice = product?.promo_active && product?.promo_price ? product.promo_price : product?.price || 0;
  const hasDefinedPrice = isCustomTable && hasDefinedCustomPrice(entry);

  return {
    price: isCustomTable
      ? (hasDefinedPrice ? getCustomPriceValue(entry) : product?.price || 0)
      : basePrice * (1 - discount / 100),
    basePrice,
    isCustomTable,
    hasDefinedPrice,
    hasCustomPrice: hasDefinedPrice,
    isPromotion: hasDefinedPrice && isCustomPromotion(entry),
    hasGroupDiscount: !isCustomTable && discount !== 0,
    discount,
  };
}