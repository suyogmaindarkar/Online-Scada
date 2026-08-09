// ═══════════════════════════════════════════════════════════
// Analytics Panel — Modal showing chatbot usage stats
// Accessible from chat header (BarChart3 icon)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  X, BarChart3, Download, RotateCcw, TrendingUp,
  ThumbsUp, ThumbsDown, HelpCircle, MessageSquare,
} from 'lucide-react';
import {
  getAnalyticsSummary, exportAnalytics, resetAnalytics,
} from '../../services/chatbotAnalytics';
import { KNOWLEDGE_BASE } from '../../data/scadaKnowledgeBase';

const AnalyticsPanel = ({ onClose }) => {
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(() => getAnalyticsSummary());

  const handleExport = () => {
    const json = exportAnalytics();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `scada_chatbot_analytics_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (window.confirm('Reset all analytics data? This cannot be undone.')) {
      resetAnalytics();
      setSummary(getAnalyticsSummary());
    }
  };

  const getEntryTitle = (id) => {
    const entry = KNOWLEDGE_BASE.find(e => e.id === id);
    return entry?.question || id;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,27,67,0.7)', backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '700px', maxWidth: '100%', maxHeight: '85vh',
          background: '#FFFFFF', borderRadius: '16px',
          boxShadow: '0px 20px 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
          color: '#FFFFFF',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <BarChart3 size={22} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
              SCADA Assistant Analytics
            </p>
            <p style={{ margin: 0, fontSize: '11px', opacity: 0.85 }}>
              Local usage stats · Since {new Date(summary.startedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleExport}
            title="Export as JSON"
            style={{
              background: 'rgba(255,255,255,0.15)', color: '#FFFFFF',
              border: 'none', borderRadius: '6px', padding: '6px 10px',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={handleReset}
            title="Reset analytics"
            style={{
              background: 'rgba(220,38,38,0.5)', color: '#FFFFFF',
              border: 'none', borderRadius: '6px', padding: '6px 10px',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: '#FFFFFF',
              border: 'none', cursor: 'pointer', padding: '6px',
              borderRadius: '6px', display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: '#F1F5F9',
          borderBottom: '1px solid #E5E7EB',
        }}>
          {[
            { id: 'overview',    label: 'Overview',    icon: TrendingUp },
            { id: 'top',         label: 'Top Asked',   icon: MessageSquare },
            { id: 'feedback',    label: 'Feedback',    icon: ThumbsUp },
            { id: 'unmatched',   label: 'Unmatched',   icon: HelpCircle },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: tab === t.id ? '#2563EB' : '#5F6B7A',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: '12px',
                borderBottom: tab === t.id ? '2px solid #2563EB' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px',
          background: '#F8FAFC',
        }}>
          {tab === 'overview' && (
            <>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <StatCard label="Total Queries" value={summary.totalQueries} color="#2563EB" />
                <StatCard label="Match Rate" value={`${summary.matchRate}%`} color="#16A34A" />
                <StatCard label="Unmatched" value={summary.unmatchedQueries} color="#DC2626" />
              </div>

              <SectionTitle icon={TrendingUp} label="Recent Queries" />
              {summary.recentQueries.length === 0 ? (
                <EmptyState text="No queries yet — start chatting!" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {summary.recentQueries.slice(0, 10).map((q, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: '#FFFFFF',
                      borderRadius: '6px', border: '1px solid #E5E7EB',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '12px',
                    }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px',
                        fontSize: '9px', fontWeight: 700,
                        background: q.matchType === 'answer' ? '#DCFCE7' : q.matchType === 'ambiguous' ? '#FEF3C7' : '#FEE2E2',
                        color:      q.matchType === 'answer' ? '#15803D' : q.matchType === 'ambiguous' ? '#78350F' : '#991B1B',
                      }}>
                        {q.matchType === 'answer' ? 'MATCH' : q.matchType === 'ambiguous' ? 'AMBIG' : 'NO'}
                      </span>
                      <span style={{ flex: 1, color: '#334155' }}>{q.query}</span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {new Date(q.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'top' && (
            <>
              <SectionTitle icon={MessageSquare} label="Top 10 Most Asked" />
              {summary.topAsked.length === 0 ? (
                <EmptyState text="No data yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {summary.topAsked.map((entry, i) => (
                    <div key={entry.id} style={{
                      padding: '10px 12px', background: '#FFFFFF',
                      borderRadius: '8px', border: '1px solid #E5E7EB',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: i < 3 ? '#2563EB' : '#E5E7EB',
                        color:      i < 3 ? '#FFFFFF' : '#5F6B7A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '12px', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: '12.5px', color: '#081B43', fontWeight: 500 }}>
                        {getEntryTitle(entry.id)}
                      </span>
                      <span style={{
                        padding: '3px 8px', background: '#EEF6FF',
                        color: '#2563EB', borderRadius: '10px',
                        fontSize: '11px', fontWeight: 700,
                      }}>
                        {entry.hits} hits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'feedback' && (
            <>
              <SectionTitle icon={ThumbsUp} label="Top Liked (Most Helpful)" />
              {summary.topLiked.length === 0 ? (
                <EmptyState text="No feedback yet — 👍/👎 answers to help improve!" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {summary.topLiked.map((entry) => (
                    <div key={entry.id} style={{
                      padding: '10px 12px', background: '#FFFFFF',
                      borderRadius: '8px', border: '1px solid #86EFAC',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <span style={{ flex: 1, fontSize: '12.5px', color: '#081B43', fontWeight: 500 }}>
                        {getEntryTitle(entry.id)}
                      </span>
                      <span style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                        <span style={{ color: '#16A34A', fontWeight: 700 }}>👍 {entry.likes}</span>
                        {entry.dislikes > 0 && (
                          <span style={{ color: '#DC2626' }}>👎 {entry.dislikes}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <SectionTitle icon={ThumbsDown} label="Needs Improvement" />
              {summary.needsImprovement.length === 0 ? (
                <EmptyState text="No answers flagged for improvement 🎉" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {summary.needsImprovement.map((entry) => (
                    <div key={entry.id} style={{
                      padding: '10px 12px', background: '#FFFFFF',
                      borderRadius: '8px', border: '1px solid #FCA5A5',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <span style={{ flex: 1, fontSize: '12.5px', color: '#081B43', fontWeight: 500 }}>
                        {getEntryTitle(entry.id)}
                      </span>
                      <span style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                        <span style={{ color: '#DC2626', fontWeight: 700 }}>👎 {entry.dislikes}</span>
                        {entry.likes > 0 && <span style={{ color: '#16A34A' }}>👍 {entry.likes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'unmatched' && (
            <>
              <SectionTitle icon={HelpCircle} label="Unmatched Queries (Add to Knowledge Base)" />
              {summary.recentUnmatched.length === 0 ? (
                <EmptyState text="All queries matched! 🎯" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {summary.recentUnmatched.map((q, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: '#FEF9C3',
                      borderRadius: '6px', border: '1px solid #FDE68A',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '12px',
                    }}>
                      <HelpCircle size={12} style={{ color: '#78350F', flexShrink: 0 }} />
                      <span style={{ flex: 1, color: '#78350F' }}>{q.query}</span>
                      <span style={{ fontSize: '10px', color: '#A16207' }}>
                        {new Date(q.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{
                marginTop: '16px', padding: '10px', background: '#EEF6FF',
                borderRadius: '6px', border: '1px solid rgba(37,99,235,0.3)',
                fontSize: '11px', color: '#334155', lineHeight: 1.5,
              }}>
                💡 <strong>Tip for developers:</strong> Add unmatched queries to
                <code style={{ background: '#DBEAFE', padding: '1px 5px', borderRadius: '3px', margin: '0 3px' }}>
                  scadaKnowledgeBase.js
                </code>
                to improve match rate over time.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', background: '#F1F5F9',
          borderTop: '1px solid #E5E7EB',
          fontSize: '10px', color: '#94A3B8', textAlign: 'center',
        }}>
          🔒 100% local · Data stored in browser localStorage · Never sent to server
        </div>
      </div>
    </div>
  );
};

// ═══ Helpers ═══
const StatCard = ({ label, value, color }) => (
  <div style={{
    padding: '14px', background: '#FFFFFF', borderRadius: '10px',
    border: '1px solid #E5E7EB', textAlign: 'center',
  }}>
    <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color, fontFamily: "'Montserrat', sans-serif" }}>
      {value}
    </p>
    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#5F6B7A', textTransform: 'uppercase', fontWeight: 600 }}>
      {label}
    </p>
  </div>
);

const SectionTitle = ({ icon: Icon, label }) => (
  <p style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
    color: '#081B43', textTransform: 'uppercase', letterSpacing: '0.05em',
  }}>
    <Icon size={13} />
    {label}
  </p>
);

const EmptyState = ({ text }) => (
  <div style={{
    padding: '30px', textAlign: 'center',
    color: '#94A3B8', fontSize: '12px', fontStyle: 'italic',
  }}>
    {text}
  </div>
);

export default AnalyticsPanel;