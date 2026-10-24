import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CartItem, Page, ChatThread, ChatMessage, Product } from '../types';
import { chatThreads as initialChats, products as allProducts, orders as initialOrders } from '../data/mockData';

interface NavigationState {
  page: Page;
  productId?: string;
  sellerId?: string;
  chatId?: string;
  searchQuery?: string;
  category?: string;
}

interface AppContextType {
  nav: NavigationState;
  navigate: (state: NavigationState) => void;
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => { [key: string]: number };
  cartItemCount: number;
  chats: ChatThread[];
  sendMessage: (chatId: string, text: string) => void;
  currentUserId: string;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  orders: typeof initialOrders;
  myProducts: Product[];
  addProduct: (product: Product) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavigationState>({ page: 'home' });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chats, setChats] = useState<ChatThread[]>(initialChats);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [orders] = useState(initialOrders);
  const [myProducts, setMyProducts] = useState<Product[]>(
    allProducts.filter(p => p.sellerId === 'currentUser')
  );
  const currentUserId = 'currentUser';

  const navigate = useCallback((state: NavigationState) => {
    setNav(state);
    window.scrollTo(0, 0);
  }, []);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = useCallback(() => {
    const totals: { [key: string]: number } = {};
    cart.forEach(item => {
      const key = item.product.cryptoCurrency;
      totals[key] = (totals[key] || 0) + item.product.price * item.quantity;
    });
    return totals;
  }, [cart]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const sendMessage = useCallback((chatId: string, text: string) => {
    const msg: ChatMessage = {
      id: `m_${Date.now()}`,
      senderId: currentUserId,
      receiverId: '',
      text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setChats(prev =>
      prev.map(chat => {
        if (chat.id === chatId) {
          const otherUser = chat.participantIds.find(id => id !== currentUserId) || '';
          return {
            ...chat,
            messages: [...chat.messages, { ...msg, receiverId: otherUser }],
            lastMessage: text,
            lastMessageTime: msg.timestamp,
          };
        }
        return chat;
      })
    );
  }, []);

  const addProduct = useCallback((product: Product) => {
    setMyProducts(prev => [product, ...prev]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        nav, navigate, cart, addToCart, removeFromCart, updateCartQuantity,
        clearCart, cartTotal, cartItemCount, chats, sendMessage,
        currentUserId, isLoggedIn, setIsLoggedIn, orders, myProducts, addProduct,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
