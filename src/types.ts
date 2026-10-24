export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  rating: number;
  totalSales: number;
  totalReviews: number;
  joinedDate: string;
  walletAddress: string;
  isVerified: boolean;
  storeBanner?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  cryptoCurrency: CryptoCurrency;
  images: string[];
  category: string;
  condition: 'New' | 'Like New' | 'Good' | 'Fair' | 'Used';
  sellerId: string;
  rating: number;
  reviewCount: number;
  stock: number;
  tags: string[];
  createdAt: string;
  shipping: string;
  views: number;
}

export type CryptoCurrency = 'BTC' | 'ETH' | 'USDT' | 'SOL';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  productId?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Order {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  quantity: number;
  totalPrice: number;
  cryptoCurrency: CryptoCurrency;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'disputed';
  txHash: string;
  createdAt: string;
}

export type Page = 'home' | 'product' | 'seller' | 'dashboard' | 'cart' | 'checkout' | 'chat' | 'login' | 'search' | 'list-product';
