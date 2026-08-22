// ═══════════════════════════════════════════════════════════
// RecipeExecute — Blue theme + confirmation step
//
// Task Bundle applied:
//   ✅ T051  — 2-step confirmation: Review → Confirm → Execute
//              + optional execution note
//   ✅ BONUS — Blue theme rebrand, per-parameter live status,
//              duration display, better result summary
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { X, Play, CheckCircle, XCircle, AlertTriangle, Loader2, Clock } from 'lucide-react';

// ─── Theme ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  btnPrimary: '#2563EB',
  btnHover:   '#1D4ED8',
  success:    '#16A34A',
  danger:     '#DC2626',
  warning:    '#F59E0B',
};

const RecipeExecute = ({ recipe, onExecute, onClose }) => {
  const [step, setStep] = useState('review'); // 'review' | 'confirm' | 'executing' | 'done'
  const [result, setResult] = useState(null);
  const [note, setNote] = useState('');

  const handleProceedToConfirm = () => setStep('confirm');
  const handleBack = () => setStep('review');

  const handleExecute = async () => {
    setStep('executing');
    try {
      const res = await onExecute(recipe._id, note);
      setResult(res);
      setStep('done');
    } catch (err) {
      setResult({
        success: false,
        error: err.response?.data?.message || 'Execution failed',
      });
      setStep('done');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 27, 67, 0.50)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'executing') onClose(); }}
    >
      <div
        style={{
          background: C.card,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '672px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${C.border}`,
          boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
            <Play className="w-6 h-6" style={{ color: C.success }} />
            Execute Recipe
          </h2>
          {step !== 'executing' && (
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex items-center px-6 py-3 gap-2" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <ProgressStep num={1} label="Review" active={step === 'review'} done={['confirm', 'executing', 'done'].includes(step)} />
          <div className="flex-1 h-0.5" style={{ background: ['confirm', 'executing', 'done'].includes(step) ? C.brand : C.border }} />
          <ProgressStep num={2} label="Confirm" active={step === 'confirm'} done={['executing', 'done'].includes(step)} />
          <div className="flex-1 h-0.5" style={{ background: ['executing', 'done'].includes(step) ? C.brand : C.border }} />
          <ProgressStep num={3} label="Execute" active={step === 'executing'} done={step === 'done'} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Recipe Info */}
          <div
            className="rounded-lg p-4 mb-4"
            style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
          >
            <h3 className="text-lg font-bold" style={{ color: C.heading }}>{recipe.recipeName}</h3>
            {recipe.description && (
              <p className="text-sm mt-1" style={{ color: C.muted }}>{recipe.description}</p>
            )}
            <div className="flex gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded" style={{ background: C.cardHover, color: C.brand }}>{recipe.category}</span>
              <span className="px-2 py-0.5 rounded font-mono" style={{ background: C.cardSubtle, color: C.text, border: `1px solid ${C.border}` }}>v{recipe.version}</span>
              <span className="px-2 py-0.5 rounded" style={{ background: C.cardSubtle, color: C.muted, border: `1px solid ${C.border}` }}>
                {recipe.parameters?.length || 0} parameters
              </span>
            </div>
          </div>

          {/* Step 1: Review */}
          {step === 'review' && (
            <>
              <div
                className="p-3 mb-4 rounded-lg flex items-start gap-2"
                style={{ background: '#FEF3C7', border: `1px solid ${C.warning}` }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
                <div className="text-sm" style={{ color: '#78350F' }}>
                  <p className="font-semibold mb-1">Please Review</p>
                  <p>The following values will be written to PLC tags. Verify each parameter before proceeding.</p>
                </div>
              </div>

              <ParametersTable parameters={recipe.parameters} results={null} />
            </>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && (
            <>
              <div
                className="p-3 mb-4 rounded-lg flex items-start gap-2"
                style={{ background: '#FEE2E2', border: `1px solid ${C.danger}` }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.danger }} />
                <div className="text-sm" style={{ color: '#7F1D1D' }}>
                  <p className="font-semibold mb-1">⚠️ Final Confirmation</p>
                  <p>This action will write <strong>{recipe.parameters?.length || 0} tag values</strong> to the PLC. This cannot be undone.</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: C.muted }}>
                  Execution Note (optional — appears in log)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Shift changeover, Product A batch #123"
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                  style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                  onFocus={(e) => e.target.style.borderColor = C.brand}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                  autoFocus
                />
              </div>

              <ParametersTable parameters={recipe.parameters} results={null} compact />
            </>
          )}

          {/* Step 3: Executing */}
          {step === 'executing' && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: C.brand }} />
              <p className="text-sm font-semibold" style={{ color: C.heading }}>Executing recipe...</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Writing {recipe.parameters?.length || 0} values to PLC</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <>
              <div
                className="rounded-lg p-4 mb-4"
                style={{
                  background: result.success && result.status !== 'FAILED'
                    ? '#DCFCE7' : '#FEE2E2',
                  border: `1px solid ${result.success && result.status !== 'FAILED' ? C.success : C.danger}`,
                }}
              >
                {result.success && result.status !== 'FAILED' ? (
                  <>
                    <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#15803D' }}>
                      <CheckCircle className="w-5 h-5" />
                      Recipe Executed {result.status === 'PARTIAL' ? 'Partially' : 'Successfully'}
                    </h4>
                    <div className="text-sm space-y-1" style={{ color: '#15803D' }}>
                      <p>✅ Success: {result.stats?.success || 0} tags</p>
                      {result.stats?.failed > 0 && (
                        <p style={{ color: C.danger }}>❌ Failed: {result.stats.failed} tags</p>
                      )}
                      {result.durationMs && (
                        <p className="flex items-center gap-1 text-xs mt-2" style={{ color: C.muted }}>
                          <Clock className="w-3 h-3" />
                          Duration: {result.durationMs}ms
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#B91C1C' }}>
                      <XCircle className="w-5 h-5" />
                      Execution Failed
                    </h4>
                    <p className="text-sm" style={{ color: '#B91C1C' }}>{result.error || 'Unknown error'}</p>
                  </>
                )}
              </div>

              <ParametersTable parameters={recipe.parameters} results={result?.results} />
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-between gap-3"
          style={{ borderTop: `1px solid ${C.border}`, background: C.cardSubtle }}
        >
          {step === 'review' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                style={{
                  background: '#FFFFFF',
                  color: C.heading,
                  border: `1.5px solid ${C.border}`,
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToConfirm}
                className="px-5 py-2.5 rounded-lg font-semibold text-white text-sm flex items-center gap-2 transition-colors"
                style={{
                  background: C.btnPrimary,
                  boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
                onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
              >
                Continue → Confirm
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                style={{
                  background: '#FFFFFF',
                  color: C.heading,
                  border: `1.5px solid ${C.border}`,
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
              >
                ← Back
              </button>
              <button
                onClick={handleExecute}
                className="px-5 py-2.5 rounded-lg font-semibold text-white text-sm flex items-center gap-2 transition-colors"
                style={{
                  background: C.success,
                  boxShadow: '0px 4px 12px rgba(22, 163, 74, 0.30)',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#15803D'}
                onMouseLeave={(e) => e.currentTarget.style.background = C.success}
              >
                <Play className="w-4 h-4" />
                Execute Now
              </button>
            </>
          )}

          {step === 'executing' && (
            <button
              disabled
              className="ml-auto px-5 py-2.5 rounded-lg text-white text-sm opacity-50 cursor-not-allowed"
              style={{ background: C.subtle }}
            >
              Executing...
            </button>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2.5 rounded-lg font-semibold text-white text-sm transition-colors"
              style={{
                background: C.btnPrimary,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Progress step indicator ───
const ProgressStep = ({ num, label, active, done }) => (
  <div className="flex items-center gap-2 flex-shrink-0">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        background: done ? C.success : active ? C.brand : C.border,
        color: done || active ? '#FFFFFF' : C.muted,
      }}
    >
      {done ? '✓' : num}
    </div>
    <span
      className="text-xs font-semibold"
      style={{ color: active ? C.brand : done ? C.success : C.muted }}
    >
      {label}
    </span>
  </div>
);

// ─── Parameters table ───
const ParametersTable = ({ parameters, results, compact }) => (
  <div>
    {!compact && (
      <h4 className="text-xs font-semibold mb-2 uppercase" style={{ color: C.muted }}>
        Parameters to Write
      </h4>
    )}
    <div className="rounded-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <table className="w-full text-sm">
        <thead style={{ background: C.cardSubtle }}>
          <tr>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Tag</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Value</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Unit</th>
            {results && (
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
            )}
          </tr>
        </thead>
        <tbody>
          {parameters?.map((param, index) => {
            let status = null;
            let reason = '';
            if (results) {
              const success = results.success?.find((s) => s.tagName === param.tagName);
              const failed = results.failed?.find((f) => f.tagName === param.tagName);
              status = success ? 'success' : failed ? 'failed' : null;
              reason = failed?.reason || '';
            }
            return (
              <tr
                key={index}
                style={{ borderTop: index > 0 ? `1px solid ${C.border}` : 'none' }}
              >
                <td className="px-3 py-2 font-mono text-xs" style={{ color: C.heading }}>{param.tagName}</td>
                <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: C.brand }}>{String(param.value)}</td>
                <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>{param.unit || '—'}</td>
                {results && (
                  <td className="px-3 py-2">
                    {status === 'success' && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: C.success }}>
                        <CheckCircle className="w-3.5 h-3.5" /> Done
                      </span>
                    )}
                    {status === 'failed' && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: C.danger }} title={reason}>
                        <XCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default RecipeExecute;