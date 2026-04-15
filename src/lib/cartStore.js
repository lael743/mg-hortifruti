import { base44 } from '@/api/base44Client';

const CART_KEY = 'hortifruti_cart';
let _currentUserEmail = null;
let _cartRecordId = null;
let _persistPromise = null;

export function setCartUser(email, recordId) {
  _currentUserEmail = email;
  _cartRecordId = recordId;
}

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    localStorage.removeItem(CART_KEY);
    return [];
  }
}

async function persistCartToServer(items) {
  if (!_currentUserEmail) return;
  if (_persistPromise) await _persistPromise;
  
  _persistPromise = (async () => {
    try {
      if (_cartRecordId) {
        await base44.entities.UserCart.update(_cartRecordId, { items });
      } else {
        const record = await base44.entities.UserCart.create({ user_email: _currentUserEmail, items });
        _cartRecordId = record.id;
      }
    } catch (e) {
      console.error('Cart sync error:', e);
    } finally {
      _persistPromise = null;
    }
  })();
  
  return _persistPromise;
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
  persistCartToServer(items);
}

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.product_id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.promo_active && product.promo_price ? product.promo_price : product.price,
      quantity,
      packaging_type: product.packaging_type,
      weight: product.weight,
      image_url: product.image_url,
    });
  }
  saveCart(cart);
}

export function removeFromCart(productId) {
  const cart = getCart().filter(item => item.product_id !== productId);
  saveCart(cart);
}

export function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.product_id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    saveCart(cart);
  }
}

export function clearCart() {
  saveCart([]);
}

export function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

export function getCartCount(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export async function syncCartFromServer(userEmail) {
  _currentUserEmail = userEmail;
  try {
    const records = await base44.entities.UserCart.filter({ user_email: userEmail });
    if (records.length > 0) {
      const record = records[0];
      _cartRecordId = record.id;
      const serverItems = record.items || [];
      localStorage.setItem(CART_KEY, JSON.stringify(serverItems));
      window.dispatchEvent(new Event('cart-updated'));
    } else {
      // No server record yet — push local cart to server
      const localItems = getCart();
      if (localItems.length > 0) {
        await persistCartToServer(localItems);
      }
    }
  } catch (e) {
    console.error('Cart server sync error:', e);
  }
}