import { base44 } from '@/api/base44Client';

const KEY = 'catalog_favorites';
let _currentUserEmail = null;
let _favRecordId = null;

export function setFavoritesUser(email, recordId) {
  _currentUserEmail = email;
  _favRecordId = recordId;
}

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

async function persistFavoritesToServer(product_ids) {
  if (!_currentUserEmail) return;
  try {
    if (_favRecordId) {
      await base44.entities.UserFavorites.update(_favRecordId, { product_ids });
    } else {
      const record = await base44.entities.UserFavorites.create({ user_email: _currentUserEmail, product_ids });
      _favRecordId = record.id;
    }
  } catch (e) {
    // silently fail
  }
}

function saveFavorites(ids) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event('favorites-updated'));
  persistFavoritesToServer(ids);
}

export function toggleFavorite(productId) {
  const favs = getFavorites();
  const next = favs.includes(productId) ? favs.filter(id => id !== productId) : [...favs, productId];
  saveFavorites(next);
  return next;
}

export function isFavorite(productId) {
  return getFavorites().includes(productId);
}

export async function syncFavoritesFromServer(userEmail) {
  try {
    const records = await base44.entities.UserFavorites.filter({ user_email: userEmail });
    if (records.length > 0) {
      const record = records[0];
      _favRecordId = record.id;
      _currentUserEmail = userEmail;
      const serverIds = record.product_ids || [];
      localStorage.setItem(KEY, JSON.stringify(serverIds));
      window.dispatchEvent(new Event('favorites-updated'));
    } else {
      _currentUserEmail = userEmail;
      const localIds = getFavorites();
      if (localIds.length > 0) {
        persistFavoritesToServer(localIds);
      }
    }
  } catch (e) {
    _currentUserEmail = userEmail;
  }
}