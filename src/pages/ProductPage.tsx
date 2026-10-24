import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { products, users, reviews, cryptoPrices } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { Star, ShoppingCart, MessageCircle, Shield, Truck, Eye, Plus, Minus, ArrowLeft } from 'lucide-react';

const cryptoIcons: Record<string, string> = { BTC: '₿', ETH: 'Ξ', USDT: '₮', SOL: '◎' };

export default function ProductPage() {
  const { nav, navigate, addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');

  const product = products.find(p => p.id === nav.productId);
  if (!product) return <div className="max-w-screen-2xl mx-auto px-4 py-16 text-center text-gray-400">Product not found</div>;

  const seller = users.find(u => u.id === product.sellerId);
  const productReviews = reviews.filter(r => r.productId === product.id);
  const relatedProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  const usdPrice = product.price * (cryptoPrices[product.cryptoCurrency] || 1);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <button onClick={() => navigate({ page: 'home' })} className="flex items-center gap-1 text-sm text-gray-400 hover:text-accent mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl aspect-square flex items-center justify-center relative overflow-hidden">
          <span className="text-[120px] md:text-[180px]">{product.images[0]}</span>
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.cryptoCurrency === 'BTC' ? 'bg-crypto-btc/20 text-crypto-btc' : product.cryptoCurrency === 'ETH' ? 'bg-crypto-eth/20 text-crypto-eth' : product.cryptoCurrency === 'USDT' ? 'bg-crypto-usdt/20 text-crypto-usdt' : 'bg-crypto-sol/20 text-crypto-sol'}`}>
              {product.cryptoCurrency} Only
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-success/20 text-success">{product.condition}</span>
          </div>
          <div className="absolute bottom-4 left-4 flex items-center gap-1 text-xs text-gray-400 bg-dark-900/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Eye size={12} /> {product.views.toLocaleString()} views
          </div>
        </div>

        {/* Product Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-dark-700 text-gray-300 border border-dark-500">{product.category}</span>
            {product.stock <= 5 && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-danger/20 text-danger">Only {product.stock} left!</span>}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">{product.title}</h1>

          {/* Rating */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className={i < Math.floor(product.rating) ? 'text-warning fill-warning' : 'text-dark-500'} />
              ))}
              <span className="text-sm font-medium text-white ml-1">{product.rating}</span>
            </div>
            <span className="text-sm text-gray-400">({product.reviewCount} reviews)</span>
          </div>

          {/* Price */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${product.cryptoCurrency === 'BTC' ? 'text-crypto-btc' : product.cryptoCurrency === 'ETH' ? 'text-crypto-eth' : product.cryptoCurrency === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                {cryptoIcons[product.cryptoCurrency]} {product.price} {product.cryptoCurrency}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">≈ ${usdPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
          </div>

          {/* Seller */}
          <button
            onClick={() => navigate({ page: 'seller', sellerId: product.sellerId })}
            className="flex items-center gap-3 p-3 rounded-xl bg-dark-800 border border-dark-600 hover:border-accent/50 transition-all mb-6 w-full text-left"
          >
            <span className="text-3xl">{seller?.avatar}</span>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white text-sm">{seller?.displayName}</span>
                {seller?.isVerified && <span className="text-blue-400 text-xs">✓ Verified</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span>⭐ {seller?.rating}</span>
                <span>{seller?.totalSales} sales</span>
                <span>{seller?.totalReviews} reviews</span>
              </div>
            </div>
          </button>

          {/* Quantity */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm text-gray-400">Quantity:</span>
            <div className="flex items-center gap-0 bg-dark-800 border border-dark-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="px-4 py-2 text-white font-medium text-sm min-w-[40px] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <span className="text-xs text-gray-500">{product.stock} available</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => { addToCart(product, quantity); navigate({ page: 'cart' }); }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>
            <button
              onClick={() => navigate({ page: 'chat' })}
              className="px-4 py-3.5 bg-dark-700 border border-dark-500 text-gray-300 rounded-xl hover:bg-dark-600 transition-all"
            >
              <MessageCircle size={18} />
            </button>
          </div>

          {/* Info badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-800 border border-dark-600">
              <Truck size={16} className="text-success" />
              <span className="text-xs text-gray-300">{product.shipping}</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-800 border border-dark-600">
              <Shield size={16} className="text-accent" />
              <span className="text-xs text-gray-300">Escrow Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12">
        <div className="flex border-b border-dark-600">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'description' ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            Reviews ({productReviews.length})
          </button>
        </div>

        <div className="py-6">
          {activeTab === 'description' ? (
            <div>
              <p className="text-gray-300 leading-relaxed">{product.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {product.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs bg-dark-700 text-gray-400 border border-dark-500">#{tag}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {productReviews.length === 0 ? (
                <p className="text-gray-400 text-sm">No reviews yet.</p>
              ) : (
                productReviews.map(review => {
                  const reviewer = users.find(u => u.id === review.userId);
                  return (
                    <div key={review.id} className="p-4 rounded-xl bg-dark-800 border border-dark-600">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">{reviewer?.avatar}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{reviewer?.displayName}</p>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={10} className={i < review.rating ? 'text-warning fill-warning' : 'text-dark-500'} />
                            ))}
                            <span className="text-[10px] text-gray-500 ml-1">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300">{review.comment}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related */}
      {relatedProducts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white mb-6">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
