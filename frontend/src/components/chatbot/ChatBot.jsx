// ═══════════════════════════════════════════════════════════
// SCADA Assistant v2.0 — Enhanced with:
//   ✅ Image/GIF support (lightbox viewer)
//   ✅ Thumbs up/down feedback per response
//   ✅ Analytics tracking (all queries + feedback)
//   ✅ Analytics dashboard modal
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Zap, User, ChevronRight,
  Trash2, Minus, ThumbsUp, ThumbsDown, BarChart3, Image as ImageIcon,
} from 'lucide-react';
import {
  generateResponse, getEntryById, getSuggestionsForPage,
} from '../../services/chatbotService';
import { QUICK_ACTIONS, CATEGORIES, PAGE_CONTEXT } from '../../data/scadaKnowledgeBase';
import { trackQuery, trackFeedback } from '../../services/chatbotAnalytics';
import ImageLightbox from './ImageLightbox';
import AnalyticsPanel from './AnalyticsPanel';

const ChatBot = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen]           = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [lightboxImages, setLightboxImages]   = useState(null);
  const [lightboxCaption, setLightboxCaption] = useState('');
  const [showAnalytics, setShowAnalytics]     = useState(false);
  const [feedbackGiven, setFeedbackGiven]     = useState({}); // messageIdx: 'up'|'down'
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const hiddenPaths = ['/login', '/runtime'];
  if (hiddenPaths.includes(location.pathname)) return null;

  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const suggestions = getSuggestionsForPage(location.pathname);
      const pageCategory = PAGE_CONTEXT[location.pathname];
      const contextName = CATEGORIES.find(c => c.id === pageCategory)?.label;

      setMessages([{
        role: 'assistant',
        type: 'welcome',
        text: `👋 Hi, I'm your **SCADA Assistant**.

I can help with tags, PLCs, alarms, screens, and troubleshooting.${contextName ? `\n\nI see you're on the **${contextName}** page — related topics:` : ''}`,
        suggestions: suggestions.length > 0
          ? suggestions.map(s => ({ label: s.question, query: s.question }))
          : QUICK_ACTIONS,
      }]);
    }
  }, [isOpen, location.pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSend = (queryOverride = null) => {
    const query = (queryOverride || input).trim();
    if (!query) return;

    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(query, location.pathname);

      // Track query analytics
      const matchedId = response.type === 'answer' ? response.entry?.id : null;
      trackQuery(query, matchedId, response.type);

      setMessages(prev => [...prev, { role: 'assistant', ...response }]);
      setIsTyping(false);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (query) => handleSend(query);

  const handleRelatedTopic = (topicId) => {
    const entry = getEntryById(topicId);
    if (entry) handleSend(entry.question);
  };

  const handleFeedback = (msgIdx, isPositive, entryId) => {
    if (feedbackGiven[msgIdx]) return; // already gave feedback
    setFeedbackGiven(prev => ({ ...prev, [msgIdx]: isPositive ? 'up' : 'down' }));
    trackFeedback(entryId, isPositive);
  };

  const openLightbox = (images, caption) => {
    setLightboxImages(images);
    setLightboxCaption(caption || '');
  };

  const handleClearChat  = () => { setMessages([]); setFeedbackGiven({}); };
  const handleClose      = () => { setIsOpen(false); setIsMinimized(false); };

  // ═══════════════════════════════════════════════════════════
  // FLOATING BUBBLE (closed state)
  // ═══════════════════════════════════════════════════════════
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
          color: '#FFFFFF', border: 'none', cursor: 'pointer',
          boxShadow: '0px 8px 24px rgba(37,99,235,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0px 12px 32px rgba(37,99,235,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0px 8px 24px rgba(37,99,235,0.35)';
        }}
        title="SCADA Assistant — Click for help"
      >
        <MessageCircle size={26} strokeWidth={2.2} />
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          width: '10px', height: '10px', borderRadius: '50%',
          background: '#10B981', border: '2px solid #FFFFFF',
        }} />
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MINIMIZED STATE
  // ═══════════════════════════════════════════════════════════
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          padding: '12px 18px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
          color: '#FFFFFF', cursor: 'pointer',
          boxShadow: '0px 8px 24px rgba(37,99,235,0.35)',
          display: 'flex', alignItems: 'center', gap: '10px',
          zIndex: 9998,
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600, fontSize: '13px',
        }}
      >
        <Zap size={16} strokeWidth={2.5} />
        SCADA Assistant
        <span style={{
          padding: '2px 8px', background: 'rgba(255,255,255,0.25)',
          borderRadius: '10px', fontSize: '10px', fontWeight: 700,
        }}>
          {messages.filter(m => m.role === 'assistant').length}
        </span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FULL CHAT WINDOW
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <div
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '420px', height: '620px', maxHeight: 'calc(100vh - 48px)',
          background: '#FFFFFF', borderRadius: '16px',
          boxShadow: '0px 20px 60px rgba(8,27,67,0.25), 0px 0px 0px 1px rgba(37,99,235,0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 9998, fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ═══ HEADER ═══ */}
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
          color: '#FFFFFF',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
              SCADA Assistant
            </p>
            <p style={{ margin: 0, fontSize: '11px', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#10B981', display: 'inline-block',
              }} />
              Online
            </p>
          </div>

          <HeaderButton onClick={() => setShowAnalytics(true)} title="Analytics dashboard">
            <BarChart3 size={15} />
          </HeaderButton>
          <HeaderButton onClick={handleClearChat} title="Clear chat">
            <Trash2 size={15} />
          </HeaderButton>
          <HeaderButton onClick={() => setIsMinimized(true)} title="Minimize">
            <Minus size={15} />
          </HeaderButton>
          <HeaderButton onClick={handleClose} title="Close" isDanger>
            <X size={16} />
          </HeaderButton>
        </div>

        {/* ═══ MESSAGES AREA ═══ */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          background: '#F8FAFC',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              messageIdx={idx}
              message={msg}
              feedbackState={feedbackGiven[idx]}
              onSuggestionClick={handleSuggestionClick}
              onRelatedClick={handleRelatedTopic}
              onFeedback={handleFeedback}
              onOpenLightbox={openLightbox}
            />
          ))}

          {isTyping && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Zap size={15} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <div style={{
                padding: '10px 14px', background: '#FFFFFF',
                borderRadius: '12px 12px 12px 4px',
                border: '1px solid #E5E7EB',
                display: 'flex', gap: '4px',
              }}>
                <TypingDot delay={0} />
                <TypingDot delay={0.2} />
                <TypingDot delay={0.4} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions (only show on welcome) */}
        {messages.length <= 1 && (
          <div style={{
            padding: '10px 12px', background: '#FFFFFF',
            borderTop: '1px solid #E5E7EB',
            display: 'flex', flexWrap: 'wrap', gap: '6px',
            flexShrink: 0,
          }}>
            <p style={{
              width: '100%', margin: '0 0 4px', fontSize: '10px',
              color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase',
            }}>
              Quick Actions
            </p>
            {QUICK_ACTIONS.slice(0, 4).map((qa, i) => (
              <button
                key={i}
                onClick={() => handleSend(qa.query)}
                style={{
                  padding: '5px 10px', background: '#EEF6FF',
                  color: '#2563EB',
                  border: '1px solid rgba(37,99,235,0.25)',
                  borderRadius: '14px', fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2563EB';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#EEF6FF';
                  e.currentTarget.style.color = '#2563EB';
                }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* ═══ INPUT ═══ */}
        <div style={{
          padding: '12px', background: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          display: 'flex', gap: '8px', flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about SCADA..."
            style={{
              flex: 1, padding: '10px 14px',
              border: '1px solid #E5E7EB', borderRadius: '10px',
              fontSize: '13px', outline: 'none',
              fontFamily: "'Inter', sans-serif", color: '#081B43',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            style={{
              padding: '10px 14px',
              background: input.trim() ? 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)' : '#CBD5E1',
              color: '#FFFFFF', border: 'none', borderRadius: '10px',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '6px 12px', background: '#F1F5F9',
          borderTop: '1px solid #E5E7EB',
          fontSize: '10px', color: '#94A3B8',
          textAlign: 'center', flexShrink: 0,
        }}>
          💡 100% local · 220+ topics · No API · Your feedback improves me
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages}
          caption={lightboxCaption}
          onClose={() => { setLightboxImages(null); setLightboxCaption(''); }}
        />
      )}

      {/* Analytics Panel */}
      {showAnalytics && (
        <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const HeaderButton = ({ children, onClick, title, isDanger = false }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: 'transparent', border: 'none', color: '#FFFFFF',
      cursor: 'pointer', padding: '6px', borderRadius: '6px',
      display: 'flex', alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = isDanger ? 'rgba(220,38,38,0.7)' : 'rgba(255,255,255,0.15)';
    }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    {children}
  </button>
);

const MessageBubble = ({
  message, messageIdx, feedbackState,
  onSuggestionClick, onRelatedClick, onFeedback, onOpenLightbox,
}) => {
  const isUser = message.role === 'user';
  const entry  = message.entry;

  return (
    <div style={{
      display: 'flex', gap: '8px', alignItems: 'flex-end',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {/* Avatar */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%',
        background: isUser
          ? 'linear-gradient(135deg, #64748B 0%, #475569 100%)'
          : 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isUser
          ? <User size={15} color="#FFFFFF" strokeWidth={2.5} />
          : <Zap  size={15} color="#FFFFFF" strokeWidth={2.5} />
        }
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '85%', padding: '10px 14px',
        background: isUser ? '#2563EB' : '#FFFFFF',
        color: isUser ? '#FFFFFF' : '#081B43',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        border: isUser ? 'none' : '1px solid #E5E7EB',
        fontSize: '13px', lineHeight: 1.55,
        wordWrap: 'break-word',
      }}>
        {/* Welcome/Text content */}
        {message.text && (
          <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text) }} />
        )}

        {/* Direct answer */}
        {message.type === 'answer' && entry && (
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', color: '#0F3D91' }}>
              {entry.question}
            </p>
            <div style={{
              marginTop: '8px', fontSize: '12.5px',
              color: '#334155', lineHeight: 1.6,
            }} dangerouslySetInnerHTML={{ __html: formatMarkdown(entry.answer) }} />

            {/* Image (if present) */}
            {(entry.image || entry.imageSequence) && (
              <button
                onClick={() => onOpenLightbox(
                  entry.imageSequence || entry.image,
                  entry.imageCaption
                )}
                style={{
                  marginTop: '10px', width: '100%',
                  padding: '8px', background: '#EEF6FF',
                  border: '1px dashed rgba(37,99,235,0.4)',
                  borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  color: '#2563EB', fontSize: '11px', fontWeight: 600,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
              >
                <ImageIcon size={14} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {entry.imageCaption || 'View screenshot'}
                  {entry.imageSequence && ` (${entry.imageSequence.length} steps)`}
                </span>
                <span>→</span>
              </button>
            )}

            {/* Related topics */}
            {entry.relatedTopics?.length > 0 && (
              <div style={{
                marginTop: '10px', paddingTop: '8px',
                borderTop: '1px dashed #E5E7EB',
              }}>
                <p style={{
                  margin: '0 0 6px', fontSize: '10px',
                  color: '#5F6B7A', fontWeight: 700, textTransform: 'uppercase',
                }}>
                  🔗 Related topics
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entry.relatedTopics.map(topicId => {
                    const related = getEntryById(topicId);
                    if (!related) return null;
                    return (
                      <button
                        key={topicId}
                        onClick={() => onRelatedClick(topicId)}
                        style={{
                          background: '#F1F5F9', color: '#2563EB',
                          border: '1px solid transparent',
                          borderRadius: '6px', padding: '5px 8px',
                          fontSize: '11px', fontWeight: 500,
                          cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#EEF6FF';
                          e.currentTarget.style.borderColor = '#2563EB';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#F1F5F9';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <ChevronRight size={11} />
                        {related.question}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ✅ FEEDBACK BUTTONS */}
            <div style={{
              marginTop: '10px', paddingTop: '8px',
              borderTop: '1px dashed #E5E7EB',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '11px', color: '#5F6B7A' }}>
                Was this helpful?
              </span>
              <button
                onClick={() => onFeedback(messageIdx, true, entry.id)}
                disabled={!!feedbackState}
                style={{
                  padding: '4px 8px',
                  background: feedbackState === 'up' ? '#16A34A' : 'transparent',
                  color: feedbackState === 'up' ? '#FFFFFF' : '#5F6B7A',
                  border: '1px solid #E5E7EB', borderRadius: '6px',
                  cursor: feedbackState ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: 600,
                  opacity: feedbackState && feedbackState !== 'up' ? 0.4 : 1,
                }}
              >
                <ThumbsUp size={11} />
                {feedbackState === 'up' && 'Thanks!'}
              </button>
              <button
                onClick={() => onFeedback(messageIdx, false, entry.id)}
                disabled={!!feedbackState}
                style={{
                  padding: '4px 8px',
                  background: feedbackState === 'down' ? '#DC2626' : 'transparent',
                  color: feedbackState === 'down' ? '#FFFFFF' : '#5F6B7A',
                  border: '1px solid #E5E7EB', borderRadius: '6px',
                  cursor: feedbackState ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: 600,
                  opacity: feedbackState && feedbackState !== 'down' ? 0.4 : 1,
                }}
              >
                <ThumbsDown size={11} />
                {feedbackState === 'down' && 'Noted'}
              </button>
            </div>
          </div>
        )}

        {/* Ambiguous */}
        {message.type === 'ambiguous' && (
          <div>
            <p style={{ margin: '0 0 8px' }}>{message.message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {message.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick(opt.question)}
                  style={{
                    background: '#EEF6FF', color: '#2563EB',
                    border: '1px solid rgba(37,99,235,0.3)',
                    borderRadius: '6px', padding: '6px 10px',
                    fontSize: '12px', fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  → {opt.question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No match */}
        {message.type === 'no-match' && (
          <div>
            <p style={{ margin: '0 0 8px' }}>{message.message}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {message.suggestions?.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick(s.query)}
                  style={{
                    background: '#F1F5F9', color: '#2563EB',
                    border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '4px 10px', fontSize: '11px',
                    fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Welcome suggestions */}
        {message.type === 'welcome' && message.suggestions && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {message.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick(s.query || s.question)}
                  style={{
                    background: '#EEF6FF', color: '#2563EB',
                    border: '1px solid rgba(37,99,235,0.3)',
                    borderRadius: '12px', padding: '4px 10px',
                    fontSize: '11px', fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563EB';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#EEF6FF';
                    e.currentTarget.style.color = '#2563EB';
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TypingDot = ({ delay }) => (
  <div style={{
    width: '7px', height: '7px', borderRadius: '50%', background: '#2563EB',
    animation: `bounce 1s infinite`, animationDelay: `${delay}s`,
  }}>
    <style>{`
      @keyframes bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }
    `}</style>
  </div>
);

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#0F172A;color:#93C5FD;padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:11px;font-family:monospace;margin:6px 0;">$1</pre>')
    .replace(/`([^`]+)`/g, '<code style="background:#F1F5F9;color:#DC2626;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:11.5px;">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0F3D91;">$1</strong>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0;"><span style="color:#2563EB;font-weight:700;flex-shrink:0;">$1.</span><span>$2</span></div>')
    .replace(/^-\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0;"><span style="color:#2563EB;flex-shrink:0;">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div style="height:6px;"></div>')
    .replace(/\n/g, '<br />');
}

export default ChatBot;