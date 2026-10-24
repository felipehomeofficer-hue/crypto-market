/**
 * WebSocket client for real-time chat and notifications
 */

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect(token: string) {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        // Authenticate
        this.send({ type: 'auth', token });

        // Start ping
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping' });
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handlers = this.handlers.get(data.type);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }

          // Also emit to wildcard handlers
          const allHandlers = this.handlers.get('*');
          if (allHandlers) {
            allHandlers.forEach(handler => handler(data));
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.pingInterval) clearInterval(this.pingInterval);
        // Auto-reconnect after 5 seconds
        this.reconnectTimeout = setTimeout(() => this.connect(token), 5000);
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  sendChatMessage(receiverId: string, text: string) {
    this.send({ type: 'chat_message', receiverId, text });
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
