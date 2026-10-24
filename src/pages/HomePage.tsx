import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { products, categories, cryptoPrices } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { TrendingUp, Flame, Clock, ArrowRight, Shield, Repeat, Zap } from 'lucide-react';

export default function HomePage() {
  const { navigate } = useApp();
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const trending = [...products].sort((a, b) => b.views - a.views).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-dark-900 to-primary-600/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl" />

        <div className="relative max-w-screen-2xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-6">
              <Zap size={12} />
              On-ramp & Off-ramp crypto vault
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight">
              Receive your Fiat payments to{' '}
              <span className="bg-gradient-to-r from-crypto-btc via-crypto-eth to-crypto-sol bg-clip-text text-transparent">
                Crypto
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-400 max-w-xl">
              Whether for your daily routine or to integrate into your business, we have the ideal solution for you! 
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                onClick={() => navigate({ page: 'search', searchQuery: '' })}
                className="px-6 py-3 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all"
              >
                Connect your wallet
              </button>
            </div>

            {/* Live prices */}
            <div className="flex flex-wrap gap-4 mt-10">
              {Object.entries(cryptoPrices).map(([coin, price]) => (
                <div key={coin} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/80 border border-dark-600">
                  <span className={`text-xs font-bold ${coin === 'BTC' ? 'text-crypto-btc' : coin === 'ETH' ? 'text-crypto-eth' : coin === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                    {coin}
                  </span>
                  <span className="text-sm text-white font-medium">${price.toLocaleString()}</span>
                  <span className="text-[10px] text-success flex items-center"><TrendingUp size={10} /> +2.4%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
              <Shield size={20} className="text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Escrow Protection</h3>
              <p className="text-xs text-gray-400">Funds held safely until delivery confirmed</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <Repeat size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">P2P Trading</h3>
              <p className="text-xs text-gray-400">Direct transactions, no middlemen</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600">
            <div className="w-10 h-10 rounded-lg bg-crypto-btc/20 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-crypto-btc" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Multi-Chain Payments</h3>
              <p className="text-xs text-gray-400">BTC, ETH, USDT, SOL accepted</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Flame size={20} className="text-crypto-btc" />
            <h2 className="text-xl font-bold text-white">Trending Now</h2>
          </div>
          <button
            onClick={() => navigate({ page: 'search', searchQuery: '' })}
            className="flex items-center gap-1 text-sm text-accent hover:text-accent-light transition-colors"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trending.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-screen-2xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-white mb-6">Browse Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => navigate({ page: 'search', category: cat.name })}
              className="flex items-center gap-3 p-4 rounded-xl bg-dark-800 border border-dark-600 hover:border-accent/50 hover:bg-dark-700 transition-all group"
            >
              <span className="text-2xl">{cat.icon}</span>
              <div className="text-left">
                <p className="font-medium text-white text-sm group-hover:text-accent transition-colors">{cat.name}</p>
                <p className="text-xs text-gray-500">{cat.count} items</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* All Products */}
      <section className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white">All Products</h2>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['All', ...categories.filter(c => c.count > 0).map(c => c.name)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-accent text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-white border border-dark-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
