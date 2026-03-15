import { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...'
}) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea up to max height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [message]);

  return (
    <div className={`chat-input ${message.trim() ? 'chat-input--active' : ''}`}>
      <textarea
        ref={textareaRef}
        className="text-field"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="chat-input__send"
      >
      </Button>
    </div>
  );
}
