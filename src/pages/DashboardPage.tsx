import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { products, users, cryptoPrices } from '../data/mockData';
import {
  TrendingUp, Package, DollarSign, ShoppingBag, Eye, ArrowUpRight,
  ArrowDownRight, Clock, CheckCircle, Truck, AlertTriangle, Plus
} from 'lucide-react';

const cryptoIcons: Record<string, string> = { BTC: '₿', ETH: 'Ξ', USDT: '₮', SOL: '◎' };

export default function DashboardPage() {
  const { navigate, orders, myProducts } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  const myOrders = orders.filter(o => o.sellerId === 'currentUser');
  const myPurchases = orders.filter(o => o.buyerId === 'currentUser');
  const totalRevenue = myOrders.reduce((sum, o) => sum + o.totalPrice * (cryptoPrices[o.cryptoCurrency] || 1), 0);
  const totalViews = myProducts.reduce((sum, p) => sum + p.views, 0);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-warning" />;
      case 'confirmed': return <CheckCircle size={14} className="text-primary-400" />;
      case 'shipped': return <Truck size={14} className="text-accent" />;
      case 'delivered': return <CheckCircle size={14} className="text-success" />;
      case 'disputed': return <AlertTriangle size={14} className="text-danger" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/20 text-warning';
      case 'confirmed': return 'bg-primary-400/20 text-primary-400';
      case 'shipped': return 'bg-accent/20 text-accent';
      case 'delivered': return 'bg-success/20 text-success';
      case 'disputed': return 'bg-danger/20 text-danger';
      default: return 'bg-dark-600 text-gray-400';
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Seller Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your store, products, and orders</p>
        </div>
        <button
          onClick={() => navigate({ page: 'list-product' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent to-primary-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all text-sm"
        >
          <Plus size={16} /> List Product
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <DollarSign size={20} className="text-success" />
            </div>
            <span className="flex items-center text-xs text-success"><ArrowUpRight size={12} /> +12%</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400 mt-1">Total Revenue (USD)</p>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <ShoppingBag size={20} className="text-accent" />
            </div>
            <span className="flex items-center text-xs text-success"><ArrowUpRight size={12} /> +5</span>
          </div>
          <p className="text-2xl font-bold text-white">{myOrders.length}</p>
          <p className="text-xs text-gray-400 mt-1">Orders Received</p>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-400/20 flex items-center justify-center">
              <Package size={20} className="text-primary-400" />
            </div>
            <span className="flex items-center text-xs text-danger"><ArrowDownRight size={12} /> -1</span>
          </div>
          <p className="text-2xl font-bold text-white">{myProducts.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active Listings</p>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-crypto-btc/20 flex items-center justify-center">
              <Eye size={20} className="text-crypto-btc" />
            </div>
            <span className="flex items-center text-xs text-success"><TrendingUp size={12} /> +18%</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalViews.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Views</p>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-white mb-4">Revenue Overview</h3>
        <div className="flex items-end gap-2 h-40">
          {[35, 55, 40, 70, 50, 80, 65, 90, 75, 60, 85, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-accent/80 to-primary-500/80 transition-all hover:from-accent hover:to-primary-400"
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-gray-500">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-600 mb-6">
        {(['overview', 'products', 'orders'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Recent Orders</h3>
            <div className="space-y-3">
              {myOrders.map(order => {
                const prod = products.find(p => p.id === order.productId);
                const buyer = users.find(u => u.id === order.buyerId);
                return (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700">
                    <span className="text-2xl">{prod?.images[0]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{prod?.title}</p>
                      <p className="text-xs text-gray-400">by {buyer?.displayName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-white">{cryptoIcons[order.cryptoCurrency]} {order.totalPrice}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(order.status)}`}>
                        {statusIcon(order.status)} {order.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Purchases */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">My Purchases</h3>
            <div className="space-y-3">
              {myPurchases.map(order => {
                const prod = products.find(p => p.id === order.productId);
                const seller = users.find(u => u.id === order.sellerId);
                return (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700">
                    <span className="text-2xl">{prod?.images[0]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{prod?.title}</p>
                      <p className="text-xs text-gray-400">from {seller?.displayName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-white">{cryptoIcons[order.cryptoCurrency]} {order.totalPrice}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(order.status)}`}>
                        {statusIcon(order.status)} {order.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-3">
          {myProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package size={48} className="mx-auto mb-4 text-dark-500" />
              <p className="text-gray-400">No products listed yet</p>
              <button
                onClick={() => navigate({ page: 'list-product' })}
                className="mt-4 px-5 py-2.5 bg-accent text-white font-medium rounded-xl text-sm"
              >
                List Your First Product
              </button>
            </div>
          ) : (
            myProducts.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600 hover:border-dark-500 transition-colors">
                <button onClick={() => navigate({ page: 'product', productId: p.id })} className="text-3xl shrink-0">{p.images[0]}</button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate({ page: 'product', productId: p.id })} className="text-sm font-medium text-white hover:text-accent truncate block">{p.title}</button>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{p.category}</span>
                    <span>•</span>
                    <span>{p.stock} in stock</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><Eye size={10} /> {p.views}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold ${p.cryptoCurrency === 'BTC' ? 'text-crypto-btc' : p.cryptoCurrency === 'ETH' ? 'text-crypto-eth' : p.cryptoCurrency === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                    {cryptoIcons[p.cryptoCurrency]} {p.price}
                  </p>
                  <p className="text-[10px] text-gray-500">≈ ${(p.price * (cryptoPrices[p.cryptoCurrency] || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-3">
          {[...myOrders, ...myPurchases].map(order => {
            const prod = products.find(p => p.id === order.productId);
            const otherUser = users.find(u => u.id === (order.sellerId === 'currentUser' ? order.buyerId : order.sellerId));
            const isSale = order.sellerId === 'currentUser';
            return (
              <div key={order.id} className="p-4 rounded-xl bg-dark-800 border border-dark-600">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{prod?.images[0]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{prod?.title}</p>
                    <p className="text-xs text-gray-400">
                      {isSale ? 'Sold to' : 'Bought from'} {otherUser?.displayName} • {order.createdAt}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">TX: {order.txHash}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-white">{cryptoIcons[order.cryptoCurrency]} {order.totalPrice} {order.cryptoCurrency}</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium mt-1 ${statusColor(order.status)}`}>
                      {statusIcon(order.status)} {order.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
