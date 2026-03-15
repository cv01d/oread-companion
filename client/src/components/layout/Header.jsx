import { useState } from 'react';
import useStore from '../../store/useStore';
import ChatDrawer from '../chat/ChatDrawer';
import WorldDrawer from '../world/WorldDrawer';
import ModelDrawer from '../model/ModelDrawer';

export default function Header({ ollamaStatus = 'checking', currentPage = 'chat', onNavigate }) {
  const [activeDrawer, setActiveDrawer] = useState(null);

  const closeDrawer = () => setActiveDrawer(null);

  return (
    <header className="header">
      <h1 className="header__title" onClick={() => onNavigate('chat')} style={{ cursor: 'pointer' }}>
        OREAD
      </h1>
      <nav className="header__nav">
      </nav>
      <div className="header__actions">
        <button
          className="header__world-switcher"
          onClick={() => setActiveDrawer('world')}
          title="Switch world"
        >
          Switch World
        </button>
        <button
          className="header__chat-switcher"
          onClick={() => setActiveDrawer('chat')}
          title="Switch chat"
        >
          Switch Chat
        </button>
        <button
          className="header__model-switcher"
          onClick={() => setActiveDrawer('model')}
          title="Switch model"
        >
          Switch Model
        </button>
        <button title="Menu" onClick={() => onNavigate('settings')}>⋯</button>
      </div>

      <WorldDrawer isOpen={activeDrawer === 'world'} onClose={closeDrawer} />
      <ChatDrawer isOpen={activeDrawer === 'chat'} onClose={closeDrawer} />
      <ModelDrawer isOpen={activeDrawer === 'model'} onClose={closeDrawer} />
    </header>
  );
}
