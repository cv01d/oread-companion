import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ChatInterface from './components/chat/ChatInterface';
import './styles/App.css';
import './styles/components.css';
import './styles/chat.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [models, setModels] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ progress: 0, status: '' });
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [isSending, setIsSending] = useState(false);

  // Check Ollama health on mount
  useEffect(() => {
    checkHealth();
    fetchModels();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setOllamaStatus(data.status === 'ok' ? 'connected' : 'disconnected');
    } catch (error) {
      setOllamaStatus('disconnected');
      console.error('Health check failed:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      if (data.success) {
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleSelectModel = (modelName) => {
    setSelectedModel(modelName);
    setMessages([]); // Clear messages when switching models
  };

  const handleRefreshModels = () => {
    fetchModels();
    checkHealth();
  };

  const handleDownloadModel = async (modelName) => {
    setIsDownloading(true);
    setDownloadProgress({ progress: 0, status: 'Starting download...' });

    try {
      const response = await fetch('/api/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.status === 'error') {
              alert(`Download failed: ${data.error}`);
              break;
            }

            if (data.completed) {
              setDownloadProgress({ progress: 100, status: 'Download complete!' });
              setTimeout(() => {
                fetchModels(); // Refresh models list
              }, 1000);
              break;
            }

            // Update progress
            if (data.status) {
              const progress = data.completed && data.total
                ? Math.round((data.completed / data.total) * 100)
                : 0;
              setDownloadProgress({
                progress,
                status: data.status,
                message: data.digest ? `Digest: ${data.digest.slice(0, 12)}...` : ''
              });
            }
          }
        }
      }
    } catch (error) {
      alert(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(false);
      setTimeout(() => {
        setDownloadProgress({ progress: 0, status: '' });
      }, 2000);
    }
  };

  const handleSendMessage = async (content) => {
    if (!selectedModel || isSending) return;

    // Add user message
    const userMessage = { role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    // Prepare messages for API
    const conversationHistory = [...messages, userMessage];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversationHistory.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage = { role: 'assistant', content: '', timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              alert(`Chat error: ${data.error}`);
              break;
            }

            if (data.message && data.message.content) {
              assistantMessage.content += data.message.content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { ...assistantMessage };
                return newMessages;
              });
            }
          }
        }
      }
    } catch (error) {
      alert(`Chat failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app">
      <Header ollamaStatus={ollamaStatus} />
      <div className="app-container">
        <Sidebar
          models={models}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          onRefreshModels={handleRefreshModels}
          onDownloadModel={handleDownloadModel}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
        />
        <main className="main-content">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isSending}
            selectedModel={selectedModel}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
