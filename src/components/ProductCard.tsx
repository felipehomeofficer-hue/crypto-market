import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { users, cryptoPrices } from '../data/mockData';
import { Star, Eye, ShoppingCart } from 'lucide-react';

const cryptoColors: Record<string, string> = {
  BTC: 'text-crypto-btc bg-crypto-btc/15',
  ETH: 'text-crypto-eth bg-crypto-eth/15',
  USDT: 'text-crypto-usdt bg-crypto-usdt/15',
  SOL: 'text-crypto-sol bg-crypto-sol/15',
};

const cryptoIcons: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  SOL: '◎',
};

export default function ProductCard({ product }: { product: Product }) {
  const { navigate, addToCart } = useApp();
  const seller = users.find(u => u.id === product.sellerId);
  const usdPrice = product.price * (cryptoPrices[product.cryptoCurrency] || 1);

  return (
    <div className="group bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300">
      {/* Image area */}
      <button
        onClick={() => navigate({ page: 'product', productId: product.id })}
        className="w-full aspect-[4/3] bg-gradient-to-br from-dark-700 to-dark-600 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-300 relative overflow-hidden"
      >
        <span>{product.images[0]}</span>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cryptoColors[product.cryptoCurrency]}`}>
            {product.cryptoCurrency}
          </span>
          {product.condition !== 'New' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/20 text-warning">
              {product.condition}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1 text-[10px] text-gray-400 bg-dark-900/70 backdrop-blur-sm px-2 py-1 rounded-full">
          <Eye size={10} />
          {product.views.toLocaleString()}
        </div>
      </button>

      {/* Content */}
      <div className="p-4">
        <button
          onClick={() => navigate({ page: 'product', productId: product.id })}
          className="text-left w-full"
        >
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-accent transition-colors">
            {product.title}
          </h3>
        </button>

        {/* Seller */}
        <button
          onClick={() => navigate({ page: 'seller', sellerId: product.sellerId })}
          className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 hover:text-accent transition-colors"
        >
          <span className="text-sm">{seller?.avatar}</span>
          <span>{seller?.displayName}</span>
          {seller?.isVerified && <span className="text-blue-400">✓</span>}
        </button>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={11}
                className={i < Math.floor(product.rating) ? 'text-warning fill-warning' : 'text-dark-500'}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">({product.reviewCount})</span>
        </div>

        {/* Price */}
        <div className="flex items-end justify-between mt-3">
          <div>
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${product.cryptoCurrency === 'BTC' ? 'text-crypto-btc' : product.cryptoCurrency === 'ETH' ? 'text-crypto-eth' : product.cryptoCurrency === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                {cryptoIcons[product.cryptoCurrency]} {product.price}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">≈ ${usdPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            className="p-2 rounded-lg bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all"
            title="Add to cart"
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
