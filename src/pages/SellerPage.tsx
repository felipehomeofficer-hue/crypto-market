import { useApp } from '../context/AppContext';
import { products, users } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { Star, ShieldCheck, Calendar, Package, MessageCircle } from 'lucide-react';

export default function SellerPage() {
  const { nav, navigate } = useApp();
  const seller = users.find(u => u.id === nav.sellerId);

  if (!seller) return <div className="max-w-screen-2xl mx-auto px-4 py-16 text-center text-gray-400">Seller not found</div>;

  const sellerProducts = products.filter(p => p.sellerId === seller.id);

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-accent/30 via-dark-800 to-primary-600/30 overflow-hidden">
        <div className="absolute inset-0 bg-dark-900/30" />
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-20 w-48 h-48 bg-primary-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-screen-2xl mx-auto px-4">
        {/* Profile Header */}
        <div className="-mt-16 relative z-10 mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-28 h-28 rounded-2xl bg-dark-800 border-4 border-dark-900 flex items-center justify-center text-5xl shadow-xl">
              {seller.avatar}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{seller.displayName}</h1>
                {seller.isVerified && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                    <ShieldCheck size={12} /> Verified Seller
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">@{seller.username}</p>
              <p className="text-gray-300 mt-3 max-w-2xl text-sm">{seller.bio}</p>

              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <Star size={14} className="text-warning fill-warning" />
                  <span className="text-white font-medium">{seller.rating}</span>
                  <span className="text-gray-400">({seller.totalReviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Package size={14} />
                  <span>{seller.totalSales} sales</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Calendar size={14} />
                  <span>Joined {new Date(seller.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => navigate({ page: 'chat' })}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-light transition-colors text-sm"
                >
                  <MessageCircle size={16} /> Message Seller
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="mb-8 p-4 rounded-xl bg-dark-800 border border-dark-600">
          <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
          <p className="text-sm text-gray-300 font-mono break-all">{seller.walletAddress}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{sellerProducts.length}</p>
            <p className="text-xs text-gray-400 mt-1">Products</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-crypto-btc">{seller.totalSales}</p>
            <p className="text-xs text-gray-400 mt-1">Total Sales</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warning">{seller.rating}</p>
            <p className="text-xs text-gray-400 mt-1">Rating</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">{seller.totalReviews}</p>
            <p className="text-xs text-gray-400 mt-1">Reviews</p>
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Products ({sellerProducts.length})</h2>
          </div>
          {sellerProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No products listed yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sellerProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
