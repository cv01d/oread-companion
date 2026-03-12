import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';

export default function MessageList({ messages = [] }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <p>No messages yet. Start chatting!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg, index) => (
        <ChatBubble
          key={index}
          message={msg.content}
          role={msg.role}
          timestamp={msg.timestamp}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
