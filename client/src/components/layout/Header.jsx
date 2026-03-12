export default function Header({ ollamaStatus = 'checking', currentPage = 'chat', onNavigate }) {
  const statusClass = [
    'status',
    `status--${ollamaStatus}`
  ].join(' ');

  const statusText = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    checking: 'Checking...'
  }[ollamaStatus] || 'Unknown';

  return (
    <header className="header">
      <h1 className="header__title" onClick={() => onNavigate('chat')} style={{ cursor: 'pointer' }}>
        OREAD
      </h1>
      <nav className="header__nav">
      </nav>
      <div className="header__actions">
        <button title="Menu" onClick={() => onNavigate('settings')}>⋯</button>
      </div>
    </header>
  );
}
