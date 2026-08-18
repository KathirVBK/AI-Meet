import { useState, useRef, useEffect } from 'react';
import { apiCall } from '../utils/api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await apiCall('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ question: userMessage.content })
      });

      if (result.success && result.data?.answer) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.data.answer }]);
      } else {
        const errorMsg = result.error || "Sorry, I couldn't process your request.";
        setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Error connecting to the chat service." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      const result = await apiCall('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ question: '', clear_history: true })
      });
      if (result.success) {
        setMessages([]);
      } else {
        console.error('Failed to clear history:', result.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem' }}>Club Q&A</h1>
        <button className="btn-secondary" onClick={clearHistory}>Clear History</button>
      </div>
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--neutral-text-muted)', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
              Ask questions about past meetings. The AI will answer based on the knowledge base.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--primary)' : 'var(--neutral-bg-alt)',
              color: m.role === 'user' ? 'white' : 'var(--neutral-text)',
              padding: '0.75rem 1.25rem',
              borderRadius: '16px',
              maxWidth: '80%',
              lineHeight: '1.5'
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--neutral-bg-alt)', padding: '0.75rem 1.25rem', borderRadius: '16px' }}>
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask a question..." 
            style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}
          />
          <button type="submit" className="btn-primary" disabled={loading}>Send</button>
        </form>
      </div>
    </div>
  );
}
