import { base44 } from '@/api/base44Client';

const KEY = 'catalog_favorites';
let _currentUserEmail = null;
let _favRecordId = null;
let _persistPromise = null;

export function setFavoritesUser(email, recordId) {
  _currentUserEmail = email;
  _favRecordId = recordId;
}

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

async function persistFavoritesToServer(product_ids) {
  if (!_currentUserEmail) return;
  if (_persistPromise) await _persistPromise;
  
  _persistPromise = (async () => {
    try {
      if (_favRecordId) {
        await base44.entities.UserFavorites.update(_favRecordId, { product_ids });
      } else {
        const record = await base44.entities.UserFavorites.create({ user_email: _currentUserEmail, product_ids });
        _favRecordId = record.id;
      }
    } catch (e) {
      console.error('Favorites sync error:', e);
    } finally {
      _persistPromise = null;
    }
  })();
  
  return _persistPromise;
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
  _currentUserEmail = userEmail;
  try {
    const records = await base44.entities.UserFavorites.filter({ user_email: userEmail });
    if (records.length > 0) {
      const record = records[0];
      _favRecordId = record.id;
      const serverIds = record.product_ids || [];
      localStorage.setItem(KEY, JSON.stringify(serverIds));
      window.dispatchEvent(new Event('favorites-updated'));
    } else {
      const localIds = getFavorites();
      if (localIds.length > 0) {
        await persistFavoritesToServer(localIds);
      }
    }
  } catch (e) {
    console.error('Favorites server sync error:', e);
  }
}