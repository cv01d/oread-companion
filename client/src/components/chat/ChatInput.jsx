import { useState } from 'react';
import TextField from '../ui/TextField';
import Button from '../ui/Button';

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...'
}) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`chat-input ${message.trim() ? 'chat-input--active' : ''}`}>
      <TextField
        value={message}
        onChange={setMessage}
        placeholder={placeholder}
        disabled={disabled}
        onKeyPress={handleKeyPress}
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
