import { Template } from '../schema';

export const ecommerceStoreTemplate: Template = {
  id: 'ecommerce-store',
  name: 'E-commerce Store',
  description: 'Product catalog with shopping cart, product cards, and checkout flow',
  category: 'ecommerce',
  thumbnail: '🛒',
  tags: ['ecommerce', 'store', 'shopping', 'products'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'ecommerce-store',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.344.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' },
    }, null, 2),
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>ShopWave</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`,
    'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
    'src/index.css': `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e4e4e7; line-height: 1.6; }`,
    'src/App.jsx': `import { useState } from 'react';
import { ShoppingCart, Plus, Minus, X, Package, Star } from 'lucide-react';
import './App.css';

const PRODUCTS = [
  { id: 1, name: 'Wireless Headphones', price: 79.99, rating: 4.5, image: '🎧', category: 'Electronics' },
  { id: 2, name: 'Leather Backpack', price: 129.99, rating: 4.8, image: '🎒', category: 'Accessories' },
  { id: 3, name: 'Smart Watch', price: 249.99, rating: 4.3, image: '⌚', category: 'Electronics' },
  { id: 4, name: 'Running Shoes', price: 89.99, rating: 4.7, image: '👟', category: 'Footwear' },
  { id: 5, name: 'Desk Lamp', price: 45.99, rating: 4.1, image: '💡', category: 'Home' },
  { id: 6, name: 'Coffee Maker', price: 159.99, rating: 4.6, image: '☕', category: 'Home' },
  { id: 7, name: 'Sunglasses', price: 59.99, rating: 4.4, image: '🕶️', category: 'Accessories' },
  { id: 8, name: 'Mechanical Keyboard', price: 119.99, rating: 4.9, image: '⌨️', category: 'Electronics' },
];

export default function App() {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [filter, setFilter] = useState('All');

  const categories = ['All', ...new Set(PRODUCTS.map(p => p.category))];
  const filtered = filter === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.category === filter);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalPrice = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">ShopWave</div>
          <button className="cart-btn" onClick={() => setCartOpen(!cartOpen)}>
            <ShoppingCart size={20} />
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>
        </div>
      </nav>

      <div className="content">
        <div className="filters">
          {categories.map(cat => (
            <button key={cat} className={\`filter-btn \${filter === cat ? 'active' : ''}\`} onClick={() => setFilter(cat)}>{cat}</button>
          ))}
        </div>

        <div className="product-grid">
          {filtered.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-image">{product.image}</div>
              <div className="product-info">
                <span className="product-category">{product.category}</span>
                <h3>{product.name}</h3>
                <div className="product-rating">
                  <Star size={14} fill="#eab308" color="#eab308" />
                  <span>{product.rating}</span>
                </div>
                <div className="product-bottom">
                  <span className="product-price">\${product.price}</span>
                  <button className="add-btn" onClick={() => addToCart(product)}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      {cartOpen && <div className="cart-overlay" onClick={() => setCartOpen(false)} />}
      <div className={\`cart-sidebar \${cartOpen ? 'open' : ''}\`}>
        <div className="cart-header">
          <h2>Cart ({totalItems})</h2>
          <button className="close-btn" onClick={() => setCartOpen(false)}><X size={20} /></button>
        </div>
        {cart.length === 0 ? (
          <div className="cart-empty">
            <Package size={40} />
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <span className="cart-item-image">{item.image}</span>
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <span className="cart-item-price">\${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  <div className="qty-controls">
                    <button onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                  </div>
                  <button className="remove-btn" onClick={() => removeItem(item.id)}><X size={16} /></button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <span>\${totalPrice.toFixed(2)}</span>
              </div>
              <button className="checkout-btn">Checkout</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}`,
    'src/App.css': `.app { min-height: 100vh; }
.nav { position: sticky; top: 0; z-index: 40; background: rgba(10,10,15,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); }
.nav-inner { max-width: 1200px; margin: 0 auto; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
.logo { font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #f59e0b, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.cart-btn { position: relative; background: rgba(255,255,255,0.06); border: none; color: #e4e4e7; padding: 10px; border-radius: 12px; cursor: pointer; }
.cart-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

.content { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
.filters { display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
.filter-btn { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #a1a1aa; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: inherit; }
.filter-btn:hover { background: rgba(255,255,255,0.06); }
.filter-btn.active { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.3); }

.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.product-card { border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); overflow: hidden; transition: all 0.2s; }
.product-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.1); }
.product-image { height: 160px; display: flex; align-items: center; justify-content: center; font-size: 56px; background: rgba(255,255,255,0.02); }
.product-info { padding: 16px; }
.product-category { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 1px; }
.product-info h3 { font-size: 15px; margin: 6px 0; }
.product-rating { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #a1a1aa; margin-bottom: 12px; }
.product-bottom { display: flex; justify-content: space-between; align-items: center; }
.product-price { font-size: 20px; font-weight: 700; color: #f59e0b; }
.add-btn { display: flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: 10px; background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
.add-btn:hover { background: rgba(245,158,11,0.2); }

.cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; }
.cart-sidebar { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; background: #131318; border-left: 1px solid rgba(255,255,255,0.06); z-index: 60; transform: translateX(100%); transition: transform 0.3s ease; display: flex; flex-direction: column; }
.cart-sidebar.open { transform: translateX(0); }
.cart-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.cart-header h2 { font-size: 18px; }
.close-btn { background: none; border: none; color: #71717a; cursor: pointer; padding: 4px; }
.cart-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #52525b; gap: 12px; }
.cart-items { flex: 1; overflow-y: auto; padding: 16px; }
.cart-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.03); margin-bottom: 8px; }
.cart-item-image { font-size: 28px; }
.cart-item-info { flex: 1; min-width: 0; }
.cart-item-info h4 { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cart-item-price { font-size: 13px; color: #f59e0b; }
.qty-controls { display: flex; align-items: center; gap: 8px; }
.qty-controls button { background: rgba(255,255,255,0.06); border: none; color: #e4e4e7; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.qty-controls span { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }
.remove-btn { background: none; border: none; color: #52525b; cursor: pointer; padding: 4px; }
.remove-btn:hover { color: #ef4444; }
.cart-footer { padding: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
.cart-total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; margin-bottom: 16px; }
.checkout-btn { width: 100%; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; font-size: 15px; font-weight: 700; border: none; cursor: pointer; transition: opacity 0.2s; font-family: inherit; }
.checkout-btn:hover { opacity: 0.9; }`,
  },
};
