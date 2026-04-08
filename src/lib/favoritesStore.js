const KEY = 'catalog_favorites';

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function toggleFavorite(productId) {
  const favs = getFavorites();
  const next = favs.includes(productId) ? favs.filter(id => id !== productId) : [...favs, productId];
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('favorites-updated'));
  return next;
}

export function isFavorite(productId) {
  return getFavorites().includes(productId);
}