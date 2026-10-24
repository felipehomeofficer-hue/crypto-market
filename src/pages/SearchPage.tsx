import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { products, categories } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { SlidersHorizontal, X } from 'lucide-react';
import { CryptoCurrency } from '../types';

export default function SearchPage() {
  const { nav } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(nav.category || '');
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency | ''>('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...products];

    // Search query
    if (nav.searchQuery) {
      const q = nav.searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.includes(q)) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Category
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Crypto
    if (selectedCrypto) {
      result = result.filter(p => p.cryptoCurrency === selectedCrypto);
    }

    // Condition
    if (selectedCondition) {
      result = result.filter(p => p.condition === selectedCondition);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
    }

    return result;
  }, [nav.searchQuery, selectedCategory, selectedCrypto, selectedCondition, sortBy]);

  const activeFilters = [selectedCategory, selectedCrypto, selectedCondition].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedCrypto('');
    setSelectedCondition('');
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {nav.category
              ? nav.category
              : nav.searchQuery
              ? `Results for "${nav.searchQuery}"`
              : 'All Products'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{filtered.length} products found</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-accent text-white' : 'bg-dark-700 border border-dark-500 text-gray-300 hover:text-white'}`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilters > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Filters</h3>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-accent hover:text-accent-light">
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {categories.filter(c => c.count > 0).map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === cat.name
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-gray-400 hover:text-white border border-dark-500'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Crypto */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Payment Currency</p>
              <div className="flex flex-wrap gap-2">
                {(['BTC', 'ETH', 'USDT', 'SOL'] as CryptoCurrency[]).map(crypto => (
                  <button
                    key={crypto}
                    onClick={() => setSelectedCrypto(selectedCrypto === crypto ? '' : crypto)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCrypto === crypto
                        ? crypto === 'BTC' ? 'bg-crypto-btc/20 text-crypto-btc border border-crypto-btc/30' : crypto === 'ETH' ? 'bg-crypto-eth/20 text-crypto-eth border border-crypto-eth/30' : crypto === 'USDT' ? 'bg-crypto-usdt/20 text-crypto-usdt border border-crypto-usdt/30' : 'bg-crypto-sol/20 text-crypto-sol border border-crypto-sol/30'
                        : 'bg-dark-700 text-gray-400 hover:text-white border border-dark-500'
                    }`}
                  >
                    {crypto}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Condition</p>
              <div className="flex flex-wrap gap-2">
                {['New', 'Like New', 'Good', 'Fair', 'Used'].map(cond => (
                  <button
                    key={cond}
                    onClick={() => setSelectedCondition(selectedCondition === cond ? '' : cond)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCondition === cond
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-gray-400 hover:text-white border border-dark-500'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🔍</p>
          <h3 className="text-xl font-bold text-white mb-2">No products found</h3>
          <p className="text-gray-400 text-sm">Try adjusting your filters or search query</p>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm">Clear Filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
