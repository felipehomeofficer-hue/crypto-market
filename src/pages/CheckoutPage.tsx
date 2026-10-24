import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { cryptoPrices } from '../data/mockData';
import { Shield, Copy, CheckCircle, ArrowLeft, Loader } from 'lucide-react';

const cryptoIcons: Record<string, string> = { BTC: '₿', ETH: 'Ξ', USDT: '₮', SOL: '◎' };

const walletAddresses: Record<string, string> = {
  BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
  USDT: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
  SOL: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
};

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart, navigate } = useApp();
  const [step, setStep] = useState<'review' | 'pay' | 'confirm'>('review');
  const [selectedCrypto, setSelectedCrypto] = useState('');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  const totals = cartTotal();
  const allCryptos = Object.keys(totals);

  if (cart.length === 0 && step !== 'confirm') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400">Your cart is empty</p>
        <button onClick={() => navigate({ page: 'home' })} className="mt-4 px-6 py-3 bg-accent text-white rounded-xl font-medium">Browse Products</button>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('confirm');
      clearCart();
    }, 2500);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {['Review', 'Pay', 'Done'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              (step === 'review' && i === 0) || (step === 'pay' && i <= 1) || step === 'confirm'
                ? 'bg-accent text-white'
                : 'bg-dark-700 text-gray-500'
            }`}>
              {step === 'confirm' || (step === 'pay' && i === 0) ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${
              (step === 'review' && i === 0) || (step === 'pay' && i <= 1) || step === 'confirm'
                ? 'text-white'
                : 'text-gray-500'
            }`}>{label}</span>
            {i < 2 && <div className={`w-12 h-0.5 ${
              (step === 'pay' && i === 0) || step === 'confirm'
                ? 'bg-accent'
                : 'bg-dark-600'
            }`} />}
          </div>
        ))}
      </div>

      {step === 'review' && (
        <div>
          <h1 className="text-2xl font-bold text-white mb-6">Review Your Order</h1>

          <div className="space-y-3 mb-6">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-4 p-4 rounded-xl bg-dark-800 border border-dark-600">
                <span className="text-3xl">{item.product.images[0]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.product.title}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <p className={`font-bold text-sm ${item.product.cryptoCurrency === 'BTC' ? 'text-crypto-btc' : item.product.cryptoCurrency === 'ETH' ? 'text-crypto-eth' : item.product.cryptoCurrency === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                  {cryptoIcons[item.product.cryptoCurrency]} {(item.product.price * item.quantity).toFixed(4)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-white mb-3">Payment Breakdown</h3>
            {Object.entries(totals).map(([crypto, amount]) => (
              <div key={crypto} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-400">{crypto} Payment</span>
                <span className={`font-bold ${crypto === 'BTC' ? 'text-crypto-btc' : crypto === 'ETH' ? 'text-crypto-eth' : crypto === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                  {cryptoIcons[crypto]} {amount.toFixed(4)} {crypto}
                </span>
              </div>
            ))}
            <div className="border-t border-dark-600 mt-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">USD Equivalent</span>
                <span className="text-lg font-bold text-white">
                  ${Object.entries(totals).reduce((s, [c, a]) => s + a * (cryptoPrices[c] || 1), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 mb-6">
            <Shield size={16} className="text-success shrink-0" />
            <p className="text-xs text-success">Your payment will be held in escrow until you confirm delivery.</p>
          </div>

          <button
            onClick={() => { setSelectedCrypto(allCryptos[0]); setStep('pay'); }}
            className="w-full py-3.5 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {step === 'pay' && (
        <div>
          <button onClick={() => setStep('review')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-accent mb-6">
            <ArrowLeft size={14} /> Back
          </button>

          <h1 className="text-2xl font-bold text-white mb-2">Send Crypto Payment</h1>
          <p className="text-sm text-gray-400 mb-6">Send the exact amount to the escrow wallet address below</p>

          {/* Crypto selector (if multiple) */}
          {allCryptos.length > 1 && (
            <div className="flex gap-2 mb-6">
              {allCryptos.map(crypto => (
                <button
                  key={crypto}
                  onClick={() => setSelectedCrypto(crypto)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCrypto === crypto
                      ? crypto === 'BTC' ? 'bg-crypto-btc/20 text-crypto-btc border border-crypto-btc/30' : crypto === 'ETH' ? 'bg-crypto-eth/20 text-crypto-eth border border-crypto-eth/30' : crypto === 'USDT' ? 'bg-crypto-usdt/20 text-crypto-usdt border border-crypto-usdt/30' : 'bg-crypto-sol/20 text-crypto-sol border border-crypto-sol/30'
                      : 'bg-dark-700 text-gray-400 border border-dark-500'
                  }`}
                >
                  {crypto}
                </button>
              ))}
            </div>
          )}

          {/* Payment details */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 mb-6">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-400 mb-2">Amount to send</p>
              <p className={`text-4xl font-bold ${selectedCrypto === 'BTC' ? 'text-crypto-btc' : selectedCrypto === 'ETH' ? 'text-crypto-eth' : selectedCrypto === 'USDT' ? 'text-crypto-usdt' : 'text-crypto-sol'}`}>
                {cryptoIcons[selectedCrypto]} {totals[selectedCrypto]?.toFixed(selectedCrypto === 'BTC' ? 6 : 4)} {selectedCrypto}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Send to Address (Escrow)</p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-700 border border-dark-500">
                  <p className="text-sm text-gray-300 font-mono flex-1 break-all">{walletAddresses[selectedCrypto]}</p>
                  <button
                    onClick={() => handleCopy(walletAddresses[selectedCrypto])}
                    className="p-1.5 rounded-md hover:bg-dark-600 text-gray-400 hover:text-white transition-colors shrink-0"
                  >
                    {copied ? <CheckCircle size={16} className="text-success" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* QR-like visual */}
              <div className="flex justify-center py-4">
                <div className="w-40 h-40 bg-white rounded-xl p-3 flex items-center justify-center">
                  <div className="w-full h-full bg-dark-900 rounded-lg grid grid-cols-8 grid-rows-8 gap-0.5 p-2">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} className={`rounded-[1px] ${Math.random() > 0.4 ? 'bg-dark-700' : 'bg-white'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                ⚠️ Only send {selectedCrypto} to this address. Sending any other token will result in permanent loss.
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmPayment}
            disabled={processing}
            className="w-full py-3.5 bg-gradient-to-r from-accent to-primary-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-accent/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader size={18} className="animate-spin" />
                Verifying Transaction...
              </>
            ) : (
              'I Have Sent the Payment'
            )}
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-success" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Confirmed!</h1>
          <p className="text-gray-400 mb-2">Your order has been placed successfully</p>
          <p className="text-sm text-gray-500 mb-8">Funds are held in escrow until delivery is confirmed</p>

          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 max-w-md mx-auto mb-8">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Order ID</span>
              <span className="text-sm text-white font-mono">#ORD-{Date.now().toString(36).toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Status</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-success/20 text-success">Confirmed</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Escrow</span>
              <span className="text-sm text-accent">🔒 Active</span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate({ page: 'dashboard' })}
              className="px-6 py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-light transition-colors text-sm"
            >
              View Orders
            </button>
            <button
              onClick={() => navigate({ page: 'home' })}
              className="px-6 py-3 bg-dark-700 text-gray-300 font-medium rounded-xl hover:bg-dark-600 transition-colors text-sm border border-dark-500"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
