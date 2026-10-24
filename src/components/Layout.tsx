import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search, ShoppingCart, MessageCircle, User, Menu, X, LayoutDashboard,
  Store, ChevronDown, Bitcoin, Zap
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { navigate, cartItemCount, nav, isLoggedIn } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ page: 'search', searchQuery: searchQuery.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Top banner */}
      <div className="bg-gradient-to-r from-accent/20 via-primary-600/20 to-crypto-eth/20 border-b border-dark-600">
        <div className="max-w-screen-2xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-gray-300">
          <Zap size={12} className="text-crypto-btc" />
          <span>Instantly receive Fiat payments to <strong className="text-crypto-btc">BTC</strong>, <strong className="text-crypto-eth">ETH</strong>, <strong className="text-crypto-usdt">USDT</strong>, or <strong className="text-crypto-sol">SOL</strong> — Non-custodial by design</span>
          <Zap size={12} className="text-crypto-btc" />
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center h-20 gap-4">
            {/* Logo */}
            <button
              onClick={() => navigate({ page: 'home' })}
              className="flex items-center gap-2 shrink-0"
            >
              <img src="/assets/fox-icon.png" alt="Fox vault" className="w-14 h-14 xs:w-16 xs:h-16 sm:w-16 sm:h-16 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-18 xl:h-18 shrink-0 rounded-lg object-contain" />
              <span className="text-xl font-bold bg-gradient-to-r from-accent-light to-primary-400 bg-clip-text text-transparent hidden sm:block">
                Fox vault
              </span>
            </button>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products, sellers, categories..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 pl-11 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                />
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </form>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => navigate({ page: 'chat' })}
                className={`relative p-2.5 rounded-lg transition-colors ${nav.page === 'chat' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
              >
                <MessageCircle size={20} />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full text-[10px] font-bold flex items-center justify-center text-white">3</span>
              </button>

              <button
                onClick={() => navigate({ page: 'cart' })}
                className={`relative p-2.5 rounded-lg transition-colors ${nav.page === 'cart' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
              >
                <ShoppingCart size={20} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-crypto-btc rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                    {cartItemCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate({ page: 'dashboard' })}
                className={`p-2.5 rounded-lg transition-colors ${nav.page === 'dashboard' ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
              >
                <LayoutDashboard size={20} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-primary-500 flex items-center justify-center text-sm">
                    🏪
                  </div>
                  <ChevronDown size={14} />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-dark-500">
                        <p className="font-semibold text-white text-sm">Your Store</p>
                        <p className="text-xs text-gray-400 truncate">0x1234...5678</p>
                      </div>
                      <div className="p-1">
                        <button onClick={() => { navigate({ page: 'dashboard' }); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 rounded-lg transition-colors">
                          <LayoutDashboard size={16} /> Dashboard
                        </button>
                        <button onClick={() => { navigate({ page: 'seller', sellerId: 'currentUser' }); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 rounded-lg transition-colors">
                          <Store size={16} /> My Store
                        </button>
                        <button onClick={() => { navigate({ page: 'list-product' }); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 rounded-lg transition-colors">
                          <span>📦</span> List Product
                        </button>
                        <button onClick={() => { navigate({ page: 'chat' }); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 rounded-lg transition-colors">
                          <MessageCircle size={16} /> Messages
                        </button>
                      </div>
                      <div className="p-1 border-t border-dark-500">
                        {isLoggedIn ? (
                          <button onClick={() => setUserMenuOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-dark-600 rounded-lg transition-colors">
                            Disconnect Wallet
                          </button>
                        ) : (
                          <button onClick={() => { navigate({ page: 'login' }); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-accent hover:bg-dark-600 rounded-lg transition-colors">
                            <User size={16} /> Connect Wallet
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </nav>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-600 bg-dark-800 p-4 space-y-2">
            <button onClick={() => { navigate({ page: 'home' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">🏠 Home</button>
            <button onClick={() => { navigate({ page: 'dashboard' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">📊 Dashboard</button>
            <button onClick={() => { navigate({ page: 'chat' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">💬 Messages</button>
            <button onClick={() => { navigate({ page: 'cart' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">🛒 Cart ({cartItemCount})</button>
            <button onClick={() => { navigate({ page: 'list-product' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">📦 List Product</button>
            <button onClick={() => { navigate({ page: 'seller', sellerId: 'currentUser' }); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-lg text-gray-300 hover:bg-dark-700">🏪 My Store</button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-dark-800 border-t border-dark-600 mt-12">
        <div className="max-w-screen-2xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-gradient-to-br from-accent to-primary-500 rounded-lg flex items-center justify-center">
                  <Bitcoin size={14} className="text-white" />
                </div>
                <span className="font-bold text-white">CryptoMart</span>
              </div>
              <p className="text-sm text-gray-400">The decentralized P2P marketplace. Buy and sell with crypto, no middlemen.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Marketplace</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => navigate({ page: 'home' })} className="hover:text-accent transition-colors">Browse Products</button></li>
                <li><button onClick={() => navigate({ page: 'search', category: 'Electronics' })} className="hover:text-accent transition-colors">Electronics</button></li>
                <li><button onClick={() => navigate({ page: 'search', category: 'Gaming' })} className="hover:text-accent transition-colors">Gaming</button></li>
                <li><button onClick={() => navigate({ page: 'search', category: 'Fashion' })} className="hover:text-accent transition-colors">Fashion</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Sell</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => navigate({ page: 'list-product' })} className="hover:text-accent transition-colors">List a Product</button></li>
                <li><button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-accent transition-colors">Seller Dashboard</button></li>
                <li><button className="hover:text-accent transition-colors">Seller Guidelines</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Crypto Payments</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 rounded-md bg-crypto-btc/20 text-crypto-btc text-xs font-medium">BTC</span>
                <span className="px-2 py-1 rounded-md bg-crypto-eth/20 text-crypto-eth text-xs font-medium">ETH</span>
                <span className="px-2 py-1 rounded-md bg-crypto-usdt/20 text-crypto-usdt text-xs font-medium">USDT</span>
                <span className="px-2 py-1 rounded-md bg-crypto-sol/20 text-crypto-sol text-xs font-medium">SOL</span>
              </div>
              <p className="text-xs text-gray-500">Secure escrow-based transactions</p>
            </div>
          </div>
          <div className="border-t border-dark-600 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">© 2024 CryptoMart. Decentralized Commerce.</p>
            <div className="flex gap-4 text-xs text-gray-500">
              <button className="hover:text-gray-300">Privacy</button>
              <button className="hover:text-gray-300">Terms</button>
              <button className="hover:text-gray-300">Escrow Policy</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
