// Simple cart store using localStorage
const CART_KEY = 'hortifruti_cart';

export function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cart-updated'));
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