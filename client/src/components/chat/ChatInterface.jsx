import MessageHistoryViewer from './MessageHistoryViewer';
import ChatInput from './ChatInput';

export default function ChatInterface({
  messages = [],
  onSendMessage,
  isLoading = false,
  selectedModel = null
}) {
  if (!selectedModel) {
    return (
      <div className="chat">
        <div className="chat__empty">
          <p>Please select a model in Settings to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat__container">
        <MessageHistoryViewer />
        <ChatInput
          onSendMessage={onSendMessage}
          disabled={isLoading}
          placeholder={isLoading ? 'Waiting for response...' : 'Type a message...'}
        />
      </div>
    </div>
  );
}
