import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sendChatMessage } from '../../services/api';

const STARTER_SUGGESTIONS = [
  'How do claims work?',
  'What does the policy cover?',
  'How is the premium calculated?',
];

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! I am Rakshak, your KAVACH assistant. Ask me about claims, policies, payouts, premiums, or how the platform works.',
  suggestions: STARTER_SUGGESTIONS,
};

export default function ChatbotWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef(null);
  const showLandingTeaser = !isOpen && location.pathname === '/';

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, loading]);

  const askQuestion = async (text) => {
    const message = text.trim();
    if (!message || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = nextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const { data } = await sendChatMessage(message, history);
      setMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        },
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I ran into a small issue reaching support right now. Please try again in a moment.',
          suggestions: STARTER_SUGGESTIONS,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-shell">
      {isOpen && (
        <div className={`chatbot-panel${location.pathname === '/' ? ' chatbot-panel-landing' : ''}`}>
          <div className="chatbot-header">
            <div>
              <div className="chatbot-title">Rakshak</div>
              <div className="chatbot-subtitle">Claims, policy, payouts, platform help</div>
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)} aria-label="Close help chat">
              x
            </button>
          </div>

          <div className="chatbot-messages" ref={viewportRef}>
            {messages.map((message) => (
              <div key={message.id} className={`chatbot-message chatbot-message-${message.role}`}>
                <div className="chatbot-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="chatbot-message chatbot-message-assistant">
                <div className="chatbot-bubble chatbot-bubble-loading">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="chatbot-suggestions">
            {(messages[messages.length - 1]?.suggestions || STARTER_SUGGESTIONS).slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                className="chatbot-chip"
                onClick={() => askQuestion(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="chatbot-inputRow"
            onSubmit={(event) => {
              event.preventDefault();
              askQuestion(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about claims, policy, premiums..."
              maxLength={500}
            />
            <button type="submit" className="chatbot-send" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      {showLandingTeaser && (
        <button className="chatbot-teaser" onClick={() => setIsOpen(true)} aria-label="Open Rakshak assistant">
          <div className="chatbot-teaser-card">Hi! I am Rakshak. Your KAVACH Assistant</div>
          <div className="chatbot-teaser-avatar">
            <img src="/delivery-hero.png" alt="Rakshak assistant" />
          </div>
        </button>
      )}

      <button className="chatbot-fab" onClick={() => setIsOpen((current) => !current)} aria-label="Open Rakshak assistant">
        <span className="chatbot-fab-badge">Help</span>
        <span className="chatbot-fab-icon">?</span>
      </button>
    </div>
  );
}
