import { useApp } from '../context/AppContext';
import { cryptoPrices } from '../data/mockData';
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react';

const cryptoIcons: Record<string, string> = { BTC: '₿', ETH: 'Ξ', USDT: '₮', SOL: '◎' };

export default function CartPage() {
  const { cart, removeFromCart, updateCartQuantity, cartTotal, navigate } = useApp();

  const totals = cartTotal();

  if (cart.length === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-16 text-center">
        <ShoppingCart size={64} className="mx-auto mb-4 text-dark-500" />
        <h2 className="text-2xl font-bold text-white mb-2">Your cart is empty</h2>
        <p className="text-gray-400 mb-6">Discover amazing products from crypto sellers</p>
        <button
          onClick={() => navigate({ page: 'home' })}
          className="px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-light transition-colors"
        >
          Browse Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">Shopping Cart ({cart.length} items)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-3">
          {cart.map(item => {
            const usdPrice = item.product.price * (cryptoPrices[item.product.cryptoCurrency] || 1);
            return (
              <div key={item.product.id} className="flex gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600">
                <button
                  onClick={() => navigate({ page: 'product', productId: item.product.id })}
                  className="w-20 h-20 shrink-0 bg-dark-700 rounded-lg flex items-center justify-center text-3xl"
                >
                  {item.product.images[0]}
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate({ page: 'product', productId: item.product.id })}
                    className="text-sm font-medium text-white hover:text-accent transition-colors truncate block text-left"
                  >
                    {item.product.title}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">{item.product.category} • {item.product.condition}</p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-0 bg-dark-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm text-white font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold text-sm ${item.product.cryptoCurrency === 'BTC' ? 'text-crypto-btc' : item.product.cryptoCurrency === 'ETH' ? 'text-crypto-eth' : item.product.cryptoCurrency === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                          {cryptoIcons[item.product.cryptoCurrency]} {(item.product.price * item.quantity).toFixed(item.product.cryptoCurrency === 'BTC' ? 4 : item.product.cryptoCurrency === 'ETH' ? 3 : 2)}
                        </p>
                        <p className="text-[10px] text-gray-500">≈ ${(usdPrice * item.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 text-gray-500 hover:text-danger transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 sticky top-24">
            <h3 className="font-semibold text-white mb-4">Order Summary</h3>

            <div className="space-y-3 mb-4">
              {Object.entries(totals).map(([crypto, amount]) => (
                <div key={crypto} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total in {crypto}</span>
                  <span className={`font-bold ${crypto === 'BTC' ? 'text-crypto-btc' : crypto === 'ETH' ? 'text-crypto-eth' : crypto === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                    {cryptoIcons[crypto]} {amount.toFixed(crypto === 'BTC' ? 4 : crypto === 'ETH' ? 3 : 2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-dark-600 pt-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Estimated USD total</span>
                <span className="text-lg font-bold text-white">
                  ${Object.entries(totals)
                    .reduce((sum, [crypto, amount]) => sum + amount * (cryptoPrices[crypto] || 1), 0)
                    .toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
              <p className="text-xs text-accent">🔒 Escrow protection on all orders. Funds released only after delivery confirmation.</p>
            </div>

            <button
              onClick={() => navigate({ page: 'checkout' })}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
