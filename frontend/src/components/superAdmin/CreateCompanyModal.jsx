// ═══════════════════════════════════════════════════════════
// CreateCompanyModal — Single form to create company + admin
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import Modal from '../ui/Modal';
import { superAdminAPI } from '../../services/api';
import { Building2, User, Loader2, Copy, CheckCircle2 } from 'lucide-react';

const CreateCompanyModal = ({ isOpen, onClose, onCreated }) => {
  const [step, setStep]         = useState('form'); // 'form' | 'success'
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const [form, setForm] = useState({
    // Company
    companyName: '', slug: '',
    contactEmail: '', contactName: '', contactPhone: '',
    plan: 'trial', timezone: 'UTC', country: '',
    // Admin
    adminUsername: 'admin', adminEmail: '', adminPassword: '', adminFullName: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      // Auto-generate slug from company name
      if (name === 'companyName' && (!prev.slug || prev.slug === slugify(prev.companyName))) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const slugify = (str) =>
    str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 30);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await superAdminAPI.createCompany(form);
      setResult(res.data.data);
      setStep('success');
      if (onCreated) onCreated(res.data.data.company);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    setStep('form');
    setForm({
      companyName: '', slug: '',
      contactEmail: '', contactName: '', contactPhone: '',
      plan: 'trial', timezone: 'UTC', country: '',
      adminUsername: 'admin', adminEmail: '', adminPassword: '', adminFullName: '',
    });
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 'success' ? '✅ Company Created' : 'Create New Company'} size="lg">
      {step === 'form' && (
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

          {/* ─── COMPANY SECTION ─── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Building2 style={{ width: 16, height: 16, color: '#2563EB' }} />
              <span>Company Information</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Acme Corporation" required />
              <Field label="Workspace Slug *" name="slug" value={form.slug} onChange={handleChange} placeholder="acme-corp" required helper="URL identifier (a-z, 0-9, hyphens)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <Field label="Contact Email *" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} placeholder="contact@acme.com" required />
              <Field label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} placeholder="John Doe" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <Field label="Contact Phone" name="contactPhone" value={form.contactPhone} onChange={handleChange} placeholder="+1 555 0123" />
              <Field label="Country" name="country" value={form.country} onChange={handleChange} placeholder="India" />
              <div>
                <label style={labelStyle}>Plan *</label>
                <select name="plan" value={form.plan} onChange={handleChange} style={selectStyle}>
                  <option value="trial">Trial (14 days)</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── ADMIN SECTION ─── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <User style={{ width: 16, height: 16, color: '#DC2626' }} />
              <span>Initial Admin User</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Admin Username" name="adminUsername" value={form.adminUsername} onChange={handleChange} placeholder="admin" />
              <Field label="Admin Full Name" name="adminFullName" value={form.adminFullName} onChange={handleChange} placeholder="Company Administrator" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <Field label="Admin Email *" name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} placeholder="admin@acme.com" required />
              <Field label="Admin Password *" name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} placeholder="Min 6 characters" required helper="Share securely with the admin" />
            </div>
          </div>

          {/* ─── Actions ─── */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
            <button type="button" onClick={handleClose}
              style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#F8FAFC', color: '#334155', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: loading ? '#94A3B8' : 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
                color: '#FFFFFF', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontFamily: "'Montserrat', sans-serif",
              }}>
              {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />Creating…</> : 'Create Company'}
            </button>
          </div>
        </form>
      )}

      {step === 'success' && result && (
        <div>
          <div style={{
            padding: '16px', borderRadius: '12px', background: '#DCFCE7',
            border: '1px solid #86EFAC', marginBottom: '16px',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
          }}>
            <CheckCircle2 style={{ width: 24, height: 24, color: '#16A34A', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#166534', margin: 0 }}>
                Company created successfully!
              </p>
              <p style={{ fontSize: '12px', color: '#166534', margin: '4px 0 0' }}>
                Copy the login credentials below and share them <strong>securely</strong> with the admin.
              </p>
            </div>
          </div>

          {/* Credentials */}
          <div style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
            <CredentialRow label="Login URL" value={result.loginInfo.url} field="url" copied={copiedField === 'url'} onCopy={handleCopy} />
            <CredentialRow label="Workspace Slug" value={result.loginInfo.slug} field="slug" copied={copiedField === 'slug'} onCopy={handleCopy} />
            <CredentialRow label="Admin Email" value={result.loginInfo.adminEmail} field="email" copied={copiedField === 'email'} onCopy={handleCopy} />
            <CredentialRow label="Admin Password" value={form.adminPassword} field="password" copied={copiedField === 'password'} onCopy={handleCopy} monospace />
          </div>

          <p style={{ fontSize: '11px', color: '#DC2626', textAlign: 'center', marginTop: '12px', fontStyle: 'italic' }}>
            ⚠️ This is the ONLY time you can see this password. Save it now!
          </p>

          <button onClick={handleClose}
            style={{
              width: '100%', marginTop: '16px', padding: '10px 16px',
              borderRadius: '8px', border: 'none',
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

// ─── Sub-components ────────────────────────────────────
const Field = ({ label, helper, ...props }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input {...props} style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }} />
    {helper && <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>{helper}</p>}
  </div>
);

const CredentialRow = ({ label, value, field, copied, onCopy, monospace }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0',
    borderBottom: '1px solid #F1F5F9',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '10px', color: '#5F6B7A', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>
        {label}
      </p>
      <p style={{
        fontSize: '13px', color: '#081B43', margin: '2px 0 0',
        fontFamily: monospace ? 'monospace' : 'inherit',
        fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={value}>
        {value}
      </p>
    </div>
    <button onClick={() => onCopy(value, field)}
      style={{
        padding: '6px 10px', borderRadius: '6px', border: `1px solid ${copied ? '#16A34A' : '#E5E7EB'}`,
        background: copied ? '#DCFCE7' : '#FFFFFF', color: copied ? '#166534' : '#5F6B7A',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
      }}>
      {copied ? <><CheckCircle2 style={{ width: 12, height: 12 }} /> Copied</> : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
    </button>
  </div>
);

// ─── Styles ────────────────────────────────────────────
const sectionStyle = {
  padding: '14px', background: '#F8FAFC', borderRadius: '10px',
  border: '1px solid #E5E7EB', marginBottom: '14px',
};
const sectionHeaderStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px',
  fontSize: '12px', fontWeight: 700, color: '#081B43',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  fontFamily: "'Montserrat', sans-serif",
};
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155',
  marginBottom: '4px',
};
const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '6px',
  border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#081B43',
  fontSize: '13px', outline: 'none', transition: 'all 0.15s ease',
  fontFamily: 'inherit',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default CreateCompanyModal;