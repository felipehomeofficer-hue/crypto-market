/**
 * CryptoMart API Client
 * Connects the React frontend to the Express backend
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('cryptomart_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('cryptomart_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('cryptomart_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ===== AUTH =====

  async connectWallet(walletAddress: string, walletType: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/connect', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, walletType }),
    });
    this.setToken(result.token);
    return result;
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  async updateProfile(data: { displayName?: string; username?: string; bio?: string; avatarUrl?: string }) {
    return this.request<{ user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateAddress(data: { street: string; city: string; state: string; zip: string; country?: string; phone?: string }) {
    return this.request<{ user: any }>('/auth/address', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ===== PRODUCTS =====

  async getProducts(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ products: any[]; pagination: any }>(`/products?${query}`);
  }

  async getProduct(id: string) {
    return this.request<{ product: any }>(`/products/${id}`);
  }

  async createProduct(formData: FormData) {
    return this.request<{ product: any }>('/products', {
      method: 'POST',
      body: formData,
    });
  }

  async updateProduct(id: string, formData: FormData) {
    return this.request<{ product: any }>(`/products/${id}`, {
      method: 'PUT',
      body: formData,
    });
  }

  async deleteProduct(id: string) {
    return this.request<{ message: string }>(`/products/${id}`, { method: 'DELETE' });
  }

  async deleteProductImage(productId: string, imageId: string) {
    return this.request<{ message: string }>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' });
  }

  async addReview(productId: string, rating: number, comment: string) {
    return this.request<{ reviewId: string }>(`/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }

  // ===== ORDERS =====

  async calculateOrderPrice(productId: string, quantity: number, shippingAddress?: any) {
    return this.request<any>('/orders/calculate-price', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, shippingAddress }),
    });
  }

  async createOrder(data: { productId: string; quantity: number; shippingServiceType: string; shippingAddress?: any }) {
    return this.request<{ order: any; payment: any; priceBreakdown: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrders(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ orders: any[]; pagination: any }>(`/orders?${query}`);
  }

  async getOrder(id: string) {
    return this.request<{ order: any }>(`/orders/${id}`);
  }

  async checkPaymentStatus(orderId: string) {
    return this.request<any>(`/orders/${orderId}/payment-status`);
  }

  async confirmDelivery(orderId: string) {
    return this.request<{ message: string }>(`/orders/${orderId}/confirm-delivery`, { method: 'POST' });
  }

  async openDispute(orderId: string, reason: string) {
    return this.request<any>(`/orders/${orderId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ===== PAYMENTS =====

  async manualConfirmPayment(orderId: string, txHash?: string) {
    return this.request<any>('/payments/manual-confirm', {
      method: 'POST',
      body: JSON.stringify({ orderId, txHash }),
    });
  }

  async releaseEscrow(orderId: string) {
    return this.request<any>('/payments/release-escrow', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  async refundOrder(orderId: string, reason: string) {
    return this.request<any>('/payments/refund', {
      method: 'POST',
      body: JSON.stringify({ orderId, reason }),
    });
  }

  async getEscrowLedger(orderId?: string) {
    const query = orderId ? `?orderId=${orderId}` : '';
    return this.request<{ records: any[] }>(`/payments/escrow-ledger${query}`);
  }

  async getPlatformWallets() {
    return this.request<{ wallets: any[] }>('/payments/platform-wallets');
  }

  // ===== SHIPPING =====

  async getShippingRates(productId: string, destinationAddress?: any) {
    return this.request<any>('/shipping/rates', {
      method: 'POST',
      body: JSON.stringify({ productId, destinationAddress }),
    });
  }

  async generateSellerLabel(orderId: string, distributionCenterId: string) {
    return this.request<any>('/shipping/generate-seller-label', {
      method: 'POST',
      body: JSON.stringify({ orderId, distributionCenterId }),
    });
  }

  async generateBuyerLabel(orderId: string) {
    return this.request<any>('/shipping/generate-buyer-label', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  async markReceivedAtDC(orderId: string) {
    return this.request<any>('/shipping/mark-received-at-dc', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  async trackShipment(trackingNumber: string) {
    return this.request<any>(`/shipping/track/${trackingNumber}`);
  }

  async getDistributionCenters() {
    return this.request<{ centers: any[] }>('/shipping/distribution-centers');
  }

  // ===== ADMIN =====

  async getAdminPricing() {
    return this.request<{ pricing: any }>('/admin/pricing');
  }

  async updateAdminPricing(data: any) {
    return this.request<any>('/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAdminWallets() {
    return this.request<{ wallets: any[] }>('/admin/wallets');
  }

  async createAdminWallet(data: { label: string; currency: string; address: string; percentage: number }) {
    return this.request<{ wallet: any }>('/admin/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminWallet(id: string, data: any) {
    return this.request<{ wallet: any }>(`/admin/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminWallet(id: string) {
    return this.request<{ message: string }>(`/admin/wallets/${id}`, { method: 'DELETE' });
  }

  async getAdminDistributionCenters() {
    return this.request<{ centers: any[] }>('/admin/distribution-centers');
  }

  async createAdminDC(data: any) {
    return this.request<{ center: any }>('/admin/distribution-centers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminDC(id: string, data: any) {
    return this.request<{ center: any }>(`/admin/distribution-centers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminDC(id: string) {
    return this.request<{ message: string }>(`/admin/distribution-centers/${id}`, { method: 'DELETE' });
  }

  async getAdminUsers(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ users: any[]; pagination: any }>(`/admin/users?${query}`);
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<any>(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async verifyUser(userId: string, verified: boolean) {
    return this.request<any>(`/admin/users/${userId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ verified }),
    });
  }

  async getAdminOrders(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ orders: any[]; pagination: any }>(`/admin/orders?${query}`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<any>(`/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getAdminAnalytics() {
    return this.request<any>('/admin/analytics/overview');
  }

  async getAdminRevenue(period: number = 30) {
    return this.request<any>(`/admin/analytics/revenue?period=${period}`);
  }

  // ===== NOTIFICATIONS =====

  async getNotifications(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ notifications: any[]; unreadCount: number }>(`/admin/notifications?${query}`);
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/admin/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    return this.request<any>('/admin/notifications/read-all', { method: 'PUT' });
  }

  // ===== CHAT =====

  async getChatThreads() {
    return this.request<{ threads: any[] }>('/chat/threads');
  }

  async getChatMessages(partnerId: string, page = 1) {
    return this.request<{ messages: any[] }>(`/chat/messages/${partnerId}?page=${page}`);
  }

  async sendChatMessage(receiverId: string, text: string, orderId?: string) {
    return this.request<{ message: any }>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ receiverId, text, orderId }),
    });
  }

  // ===== HEALTH =====

  async checkHealth() {
    return this.request<any>('/health');
  }
}

// Singleton instance
export const api = new ApiClient();
export default api;
