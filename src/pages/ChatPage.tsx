import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { users, products } from '../data/mockData';
import { Send, ArrowLeft, Image, Paperclip } from 'lucide-react';

export default function ChatPage() {
  const { chats, sendMessage, currentUserId, navigate } = useApp();
  const [activeChatId, setActiveChatId] = useState<string | null>(chats[0]?.id || null);
  const [newMsg, setNewMsg] = useState('');
  const [showList, setShowList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeChatId) return;
    sendMessage(activeChatId, newMsg.trim());
    setNewMsg('');
  };

  const getOtherUser = (chat: typeof chats[0]) => {
    const otherId = chat.participantIds.find(id => id !== currentUserId);
    return users.find(u => u.id === otherId);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* Chat List */}
          <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-r border-dark-600 shrink-0`}>
            <div className="p-4 border-b border-dark-600">
              <h3 className="font-semibold text-white text-sm">Conversations ({chats.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.map(chat => {
                const otherUser = getOtherUser(chat);
                const linkedProduct = chat.productId ? products.find(p => p.id === chat.productId) : null;
                const isActive = activeChatId === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => { setActiveChatId(chat.id); setShowList(false); }}
                    className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${isActive ? 'bg-dark-700' : 'hover:bg-dark-700/50'}`}
                  >
                    <span className="text-2xl shrink-0">{otherUser?.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{otherUser?.displayName}</span>
                        <span className="text-[10px] text-gray-500">{formatDate(chat.lastMessageTime)}</span>
                      </div>
                      {linkedProduct && (
                        <p className="text-[10px] text-accent truncate mt-0.5">Re: {linkedProduct.title}</p>
                      )}
                      <p className="text-xs text-gray-400 truncate mt-0.5">{chat.lastMessage}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${!showList ? 'flex' : 'hidden'} md:flex flex-col flex-1`}>
            {activeChat ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 p-4 border-b border-dark-600">
                  <button
                    onClick={() => setShowList(true)}
                    className="md:hidden p-1 text-gray-400 hover:text-white"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <button
                    onClick={() => {
                      const otherId = activeChat.participantIds.find(id => id !== currentUserId);
                      if (otherId) navigate({ page: 'seller', sellerId: otherId });
                    }}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-2xl">{getOtherUser(activeChat)?.avatar}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{getOtherUser(activeChat)?.displayName}</p>
                      <p className="text-[10px] text-success">Online</p>
                    </div>
                  </button>
                  {activeChat.productId && (
                    <button
                      onClick={() => navigate({ page: 'product', productId: activeChat.productId })}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-dark-700 text-xs text-gray-300 hover:text-accent transition-colors border border-dark-500"
                    >
                      📦 View Product
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeChat.messages.map((msg, i) => {
                    const isMe = msg.senderId === currentUserId;
                    const showDate = i === 0 || formatDate(msg.timestamp) !== formatDate(activeChat.messages[i - 1].timestamp);
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="px-3 py-1 rounded-full bg-dark-700 text-[10px] text-gray-500">{formatDate(msg.timestamp)}</span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] ${isMe ? 'order-2' : 'order-1'}`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-accent text-white rounded-br-md'
                                : 'bg-dark-700 text-gray-200 rounded-bl-md'
                            }`}>
                              {msg.text}
                            </div>
                            <p className={`text-[10px] text-gray-500 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-dark-600">
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
                      <Paperclip size={18} />
                    </button>
                    <button type="button" className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
                      <Image size={18} />
                    </button>
                    <input
                      type="text"
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
                    />
                    <button
                      type="submit"
                      disabled={!newMsg.trim()}
                      className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent-light transition-colors disabled:opacity-30 disabled:hover:bg-accent"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
