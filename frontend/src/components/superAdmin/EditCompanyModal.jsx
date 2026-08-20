// ═══════════════════════════════════════════════════════════
// EditCompanyModal — Update company plan, status, contact info
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { superAdminAPI } from '../../services/api';
import { Loader2 } from 'lucide-react';

const EditCompanyModal = ({ isOpen, onClose, company, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({
    companyName: '', contactEmail: '', contactName: '', contactPhone: '',
    plan: 'trial', timezone: 'UTC', country: '',
    trialEndsAt: '', subscriptionExpiresAt: '',
    isActive: true, isSuspended: false, suspensionReason: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        companyName:  company.companyName || '',
        contactEmail: company.contactEmail || '',
        contactName:  company.contactName || '',
        contactPhone: company.contactPhone || '',
        plan:         company.plan || 'trial',
        timezone:     company.timezone || 'UTC',
        country:      company.country || '',
        trialEndsAt:  company.trialEndsAt ? new Date(company.trialEndsAt).toISOString().slice(0, 10) : '',
        subscriptionExpiresAt: company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toISOString().slice(0, 10) : '',
        isActive:     company.isActive !== false,
        isSuspended:  company.isSuspended || false,
        suspensionReason: company.suspensionReason || '',
      });
    }
  }, [company]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { ...form };
      // Convert dates back to ISO
      if (payload.trialEndsAt) payload.trialEndsAt = new Date(payload.trialEndsAt).toISOString();
      else payload.trialEndsAt = null;
      if (payload.subscriptionExpiresAt) payload.subscriptionExpiresAt = new Date(payload.subscriptionExpiresAt).toISOString();
      else payload.subscriptionExpiresAt = null;

      const res = await superAdminAPI.updateCompany(company._id, payload);
      if (onUpdated) onUpdated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  if (!company) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit: ${company.companyName}`} size="lg">
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', marginBottom: '16px',
            background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#7F1D1D',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '14px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '11px', color: '#5F6B7A', margin: 0 }}>
            Workspace slug: <code style={{ fontSize: '12px', color: '#081B43', fontWeight: 600 }}>/{company.slug}</code>
            <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '8px' }}>(cannot be changed)</span>
          </p>
        </div>

        {/* Company info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="Company Name" name="companyName" value={form.companyName} onChange={handleChange} />
          <Field label="Contact Email" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
          <Field label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} />
          <Field label="Contact Phone" name="contactPhone" value={form.contactPhone} onChange={handleChange} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
          <Field label="Country" name="country" value={form.country} onChange={handleChange} />
          <div>
            <label style={labelStyle}>Plan</label>
            <select name="plan" value={form.plan} onChange={handleChange} style={selectStyle}>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>
              Plan change auto-updates all limits
            </p>
          </div>
        </div>

        {/* Expiry dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px', padding: '12px', background: '#FEF9C3', borderRadius: '8px', border: '1px solid #FDE68A' }}>
          <Field label="Trial Ends" name="trialEndsAt" type="date" value={form.trialEndsAt} onChange={handleChange} />
          <Field label="Subscription Expires" name="subscriptionExpiresAt" type="date" value={form.subscriptionExpiresAt} onChange={handleChange} />
        </div>

        {/* Status */}
        <div style={{ marginTop: '14px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#081B43', margin: '0 0 8px', textTransform: 'uppercase' }}>
            Status Controls
          </p>

          <label style={checkboxStyle}>
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
            <span>Active <span style={{ fontSize: '10px', color: '#94A3B8' }}>(can log in)</span></span>
          </label>

          <label style={{ ...checkboxStyle, marginTop: '6px' }}>
            <input type="checkbox" name="isSuspended" checked={form.isSuspended} onChange={handleChange} />
            <span>Suspended <span style={{ fontSize: '10px', color: '#94A3B8' }}>(blocked, but data preserved)</span></span>
          </label>

          {form.isSuspended && (
            <div style={{ marginTop: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: '4px' }}>Suspension Reason</label>
              <input name="suspensionReason" value={form.suspensionReason} onChange={handleChange}
                placeholder="e.g. Payment overdue"
                style={inputStyle} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#334155', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: loading ? '#94A3B8' : '#2563EB', color: '#FFFFFF',
              fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontFamily: "'Montserrat', sans-serif",
            }}>
            {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const Field = ({ label, ...props }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input {...props} style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }} />
  </div>
);

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#081B43', fontSize: '13px', outline: 'none', fontFamily: 'inherit' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const checkboxStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' };

export default EditCompanyModal;