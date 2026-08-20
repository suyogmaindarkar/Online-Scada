// ═══════════════════════════════════════════════════════════
// ResetPasswordModal — Reset company admin's password
// Shows new password once for copy
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import Modal from '../ui/Modal';
import { superAdminAPI } from '../../services/api';
import { Loader2, Copy, CheckCircle2, Key, RefreshCw } from 'lucide-react';

const ResetPasswordModal = ({ isOpen, onClose, company }) => {
  const [step, setStep]         = useState('form'); // 'form' | 'success'
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);

  // ─── Random password generator ───
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await superAdminAPI.resetCompanyAdminPassword(company._id, password);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('form');
    setPassword('');
    setError('');
    setCopied(false);
    onClose();
  };

  if (!company) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reset Admin Password" size="sm">
      {step === 'form' && (
        <form onSubmit={handleSubmit}>
          <div style={{
            padding: '12px', background: '#FEF3C7', borderRadius: '8px',
            border: '1px solid #FDE68A', marginBottom: '16px',
          }}>
            <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
              <strong>Company:</strong> {company.companyName}
            </p>
            <p style={{ fontSize: '11px', color: '#92400E', margin: '4px 0 0' }}>
              This will reset the primary admin's password. Share the new password securely.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: '8px', marginBottom: '12px',
              background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <label style={labelStyle}>New Password *</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters" required minLength={6}
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
              autoFocus
            />
            <button type="button" onClick={generatePassword}
              style={{
                padding: '8px 12px', borderRadius: '6px', border: '1px solid #E5E7EB',
                background: '#F8FAFC', color: '#2563EB', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
              }}
              title="Generate random password">
              <RefreshCw style={{ width: 12, height: 12 }} />
              Generate
            </button>
          </div>
          <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
            Password will be shown once — copy it now
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={handleClose}
              style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#334155', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || password.length < 6}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: loading || password.length < 6 ? '#94A3B8' : '#F59E0B', color: '#FFFFFF',
                fontSize: '14px', fontWeight: 700, cursor: loading || password.length < 6 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontFamily: "'Montserrat', sans-serif",
              }}>
              {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />Resetting…</> : <><Key style={{ width: 14, height: 14 }} />Reset Password</>}
            </button>
          </div>
        </form>
      )}

      {step === 'success' && (
        <div>
          <div style={{
            padding: '14px', borderRadius: '10px', background: '#DCFCE7',
            border: '1px solid #86EFAC', marginBottom: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <CheckCircle2 style={{ width: 20, height: 20, color: '#16A34A', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#166534', margin: 0 }}>
                Password reset successfully!
              </p>
              <p style={{ fontSize: '11px', color: '#166534', margin: '3px 0 0' }}>
                Copy the password below and share it securely with the admin.
              </p>
            </div>
          </div>

          <label style={labelStyle}>New Password</label>
          <div style={{
            padding: '12px', background: '#F1F5F9', borderRadius: '8px',
            border: '2px dashed #2563EB', marginBottom: '10px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <code style={{
              flex: 1, fontSize: '16px', color: '#081B43', fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: '0.05em',
              wordBreak: 'break-all',
            }}>
              {password}
            </code>
            <button onClick={handleCopy}
              style={{
                padding: '8px 14px', borderRadius: '6px',
                border: `1px solid ${copied ? '#16A34A' : '#2563EB'}`,
                background: copied ? '#DCFCE7' : '#2563EB',
                color: copied ? '#166534' : '#FFFFFF',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
              }}>
              {copied ? <><CheckCircle2 style={{ width: 12, height: 12 }} />Copied</> : <><Copy style={{ width: 12, height: 12 }} />Copy</>}
            </button>
          </div>

          <p style={{ fontSize: '11px', color: '#DC2626', textAlign: 'center', fontStyle: 'italic', marginBottom: '16px' }}>
            ⚠️ This is the only time you'll see this password
          </p>

          <button onClick={handleClose}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: '#081B43', color: '#FFFFFF',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Montserrat', sans-serif",
            }}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
};

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' };
const inputStyle = { padding: '8px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#081B43', fontSize: '14px', outline: 'none', fontFamily: 'inherit' };

export default ResetPasswordModal;