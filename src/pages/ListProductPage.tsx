import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { categories } from '../data/mockData';
import { CryptoCurrency, Product } from '../types';
import { Package, CheckCircle } from 'lucide-react';

const emojiOptions = ['📱', '💻', '🎧', '⌨️', '🖥️', '🎮', '👕', '👗', '👛', '🎨', '🖼️', '🚁', '🔐', '📦', '🎁', '⚡', '🏠', '📚', '⚽', '💎'];

export default function ListProductPage() {
  const { navigate, addProduct } = useApp();
  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [crypto, setCrypto] = useState<CryptoCurrency>('USDT');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState<Product['condition']>('New');
  const [stock, setStock] = useState('1');
  const [shipping, setShipping] = useState('');
  const [tags, setTags] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !price || !category) return;

    const newProduct: Product = {
      id: `p_${Date.now()}`,
      title,
      description,
      price: parseFloat(price),
      cryptoCurrency: crypto,
      images: [selectedEmoji],
      category,
      condition,
      sellerId: 'currentUser',
      rating: 0,
      reviewCount: 0,
      stock: parseInt(stock) || 1,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString().split('T')[0],
      shipping: shipping || 'Contact seller for shipping details',
      views: 0,
    };

    addProduct(newProduct);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-success" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Product Listed!</h1>
        <p className="text-gray-400 mb-8">Your product is now live on the marketplace</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate({ page: 'dashboard' })}
            className="px-6 py-3 bg-accent text-white font-medium rounded-xl text-sm"
          >
            View Dashboard
          </button>
          <button
            onClick={() => { setSubmitted(false); setTitle(''); setDescription(''); setPrice(''); setTags(''); setShipping(''); }}
            className="px-6 py-3 bg-dark-700 border border-dark-500 text-gray-300 font-medium rounded-xl text-sm"
          >
            List Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <Package size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">List a Product</h1>
          <p className="text-sm text-gray-400">Start selling to the crypto community</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Icon */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <label className="text-sm font-medium text-white mb-3 block">Product Icon</label>
          <div className="flex flex-wrap gap-2">
            {emojiOptions.map(emoji => (
              <button
                type="button"
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition-all ${
                  selectedEmoji === emoji
                    ? 'bg-accent/20 border-2 border-accent scale-110'
                    : 'bg-dark-700 border border-dark-500 hover:bg-dark-600'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <label className="text-sm font-medium text-white mb-2 block">Product Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., iPhone 15 Pro Max 256GB"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            required
          />
        </div>

        {/* Description */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <label className="text-sm font-medium text-white mb-2 block">Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your product in detail..."
            rows={4}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent resize-none"
            required
          />
        </div>

        {/* Price & Crypto */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <label className="text-sm font-medium text-white mb-3 block">Price *</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                step="any"
                min="0"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div className="flex gap-2">
              {(['BTC', 'ETH', 'USDT', 'SOL'] as CryptoCurrency[]).map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCrypto(c)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    crypto === c
                      ? c === 'BTC' ? 'bg-crypto-btc/20 text-crypto-btc border border-crypto-btc/30' : c === 'ETH' ? 'bg-crypto-eth/20 text-crypto-eth border border-crypto-eth/30' : c === 'USDT' ? 'bg-crypto-usdt/20 text-crypto-usdt border border-crypto-usdt/30' : 'bg-crypto-sol/20 text-crypto-sol border border-crypto-sol/30'
                      : 'bg-dark-700 text-gray-400 border border-dark-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category & Condition */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                required
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value as Product['condition'])}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Used">Used</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stock & Shipping */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Stock Quantity</label>
              <input
                type="number"
                value={stock}
                onChange={e => setStock(e.target.value)}
                min="1"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Shipping Info</label>
              <input
                type="text"
                value={shipping}
                onChange={e => setShipping(e.target.value)}
                placeholder="e.g., Free worldwide shipping"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <label className="text-sm font-medium text-white mb-2 block">Tags (comma separated)</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g., electronics, premium, sealed"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3.5 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all"
        >
          List Product
        </button>
      </form>
    </div>
  );
}
