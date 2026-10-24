import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Bitcoin, Shield, ArrowRight } from 'lucide-react';

const wallets = [
  { name: 'MetaMask', icon: '🦊', desc: 'Connect with MetaMask wallet' },
  { name: 'Phantom', icon: '👻', desc: 'Connect with Phantom (Solana)' },
  { name: 'WalletConnect', icon: '🔗', desc: 'Scan QR code with any wallet' },
  { name: 'Coinbase Wallet', icon: '🔵', desc: 'Connect with Coinbase Wallet' },
  { name: 'Trust Wallet', icon: '🛡️', desc: 'Connect with Trust Wallet' },
  { name: 'Ledger', icon: '🔐', desc: 'Connect with Ledger hardware wallet' },
];

export default function LoginPage() {
  const { navigate, setIsLoggedIn } = useApp();
  const [connecting, setConnecting] = useState('');

  const handleConnect = (walletName: string) => {
    setConnecting(walletName);
    setTimeout(() => {
      setIsLoggedIn(true);
      navigate({ page: 'home' });
    }, 1500);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bitcoin size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
          <p className="text-sm text-gray-400 mt-2">Connect your crypto wallet to start buying and selling</p>
        </div>

        {/* Wallet options */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-2">
          {wallets.map(wallet => (
            <button
              key={wallet.name}
              onClick={() => handleConnect(wallet.name)}
              disabled={!!connecting}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-dark-700 border border-dark-500 hover:border-accent/50 hover:bg-dark-600 transition-all disabled:opacity-50 group"
            >
              <span className="text-2xl shrink-0">{wallet.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-medium text-white text-sm group-hover:text-accent transition-colors">{wallet.name}</p>
                <p className="text-xs text-gray-500">{wallet.desc}</p>
              </div>
              {connecting === wallet.name ? (
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight size={16} className="text-gray-500 group-hover:text-accent transition-colors" />
              )}
            </button>
          ))}
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 mt-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
          <Shield size={18} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-medium">Non-Custodial</p>
            <p className="text-xs text-gray-400">We never have access to your private keys. You remain in full control of your funds.</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          By connecting, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
