export default function ChatBubble({ message, role, timestamp }) {
  const classes = [
    'chat-bubble',
    `chat-bubble--${role}`
  ].join(' ');

  return (
    <div className={classes}>
      <div className="chat-bubble__content">{message}</div>
      {timestamp && (
        <div className="chat-bubble__timestamp">
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
