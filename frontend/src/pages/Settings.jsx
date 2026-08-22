// Frontend/src/pages/Settings.jsx
// ═══════════════════════════════════════════════════════════
// Settings Page — Multi-Tenant & Centralized API update
// ✅ FIXED: Uses settingsAPI from central api.js instead of local axios
// ✅ FIXED: Resolves "View Only" role parsing for administrators
// ═══════════════════════════════════════════════════════════

import { normalizeColor } from '../utils/colorUtils';
import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon, Palette, Bell, Server, Database, Shield,
  Info, Download, Upload, RotateCcw, Save, ChevronRight, Monitor, Grid, Clock,
  Volume2, AlertTriangle, Activity, CheckCircle, XCircle,
  RefreshCw, Globe, Lock, Zap, Calendar, Trash2, Package, Timer,
} from 'lucide-react';

// Use central api service
import api, { settingsAPI } from '../services/api';

// ═══════════════════════════════════════════════════════════
// COLOR TOKENS (blue theme)
// ═══════════════════════════════════════════════════════════
const C = {
  bg:           '#F8FAFC',      // page background
  card:         '#FFFFFF',      // cards
  cardSubtle:   '#F8FAFC',      // subtle bg (inputs)
  cardHover:    '#EEF6FF',      // hover
  border:       '#E5E7EB',      // default border
  borderStrong: '#CBD5E1',      // emphasized border
  heading:      '#081B43',      // headings
  text:         '#334155',      // body
  muted:        '#5F6B7A',      // muted
  subtle:       '#94A3B8',      // hints
  brand:        '#2563EB',      // brand accent
  brandDark:    '#0F3D91',      // deep brand
  btnPrimary:   '#081B43',      // primary CTA
  btnHover:     '#123E8A',      // primary hover
  success:      '#16A34A',
  warning:      '#F59E0B',
  danger:       '#DC2626',
  info:         '#2563EB',
};

/* ════════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ════════════════════════════════════════════════════════════════════════════ */

const Toast = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium min-w-[280px]"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.12)',
        }}
      >
        {toast.type === 'success' ? (
          <CheckCircle size={16} className="shrink-0" style={{ color: C.success }} />
        ) : toast.type === 'error' ? (
          <XCircle size={16} className="shrink-0" style={{ color: C.danger }} />
        ) : (
          <AlertTriangle size={16} className="shrink-0" style={{ color: C.warning }} />
        )}
        <span style={{ color: C.heading }}>{toast.message}</span>
        <button onClick={() => removeToast(toast.id)} className="ml-auto" style={{ color: C.subtle }}>
          ×
        </button>
      </div>
    ))}
  </div>
);

const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    style={{ backgroundColor: checked ? C.brand : C.borderStrong }}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

const SectionCard = ({ children, title, icon: Icon, description, action }) => (
  <div
    className="rounded-2xl p-6 mb-6"
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
    }}
  >
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: C.cardHover }}
        >
          <Icon size={20} style={{ color: C.brand }} />
        </div>
        <div>
          <h3 className="font-semibold text-base" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
            {title}
          </h3>
          {description && (
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const FormField = ({ label, hint, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-xs mt-1" style={{ color: C.subtle }}>{hint}</p>}
  </div>
);

const Input = ({ type = 'text', value, onChange, min, max, placeholder, disabled, className = '' }) => (
  <input
    type={type}
    value={value ?? ''}
    onChange={onChange}
    min={min}
    max={max}
    placeholder={placeholder}
    disabled={disabled}
    className={`w-full px-3 py-2 rounded-xl text-sm outline-none transition-all ${className}`}
    style={{
      background: C.cardSubtle,
      border: `1px solid ${C.border}`,
      color: C.heading,
    }}
    onFocus={(e) => { e.target.style.borderColor = C.brand; }}
    onBlur={(e) => { e.target.style.borderColor = C.border; }}
  />
);

const Select = ({ value, onChange, children, disabled }) => (
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
    style={{
      background: C.cardSubtle,
      border: `1px solid ${C.border}`,
      color: C.heading,
    }}
    onFocus={(e) => { e.target.style.borderColor = C.brand; }}
    onBlur={(e) => { e.target.style.borderColor = C.border; }}
  >
    {children}
  </select>
);

const ToggleRow = ({ label, hint, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
    <div>
      <p className="text-sm font-medium" style={{ color: C.heading }}>{label}</p>
      {hint && <p className="text-xs mt-0.5" style={{ color: C.subtle }}>{hint}</p>}
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

const StatBadge = ({ label, value, color = C.brand }) => (
  <div className="rounded-xl p-4 text-center"
    style={{ background: C.cardHover, border: `1px solid ${C.border}` }}>
    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    <p className="text-xs mt-1 font-medium" style={{ color: C.muted }}>{label}</p>
  </div>
);

const SaveButton = ({ onClick, saving, isAdmin }) => (
  <button
    onClick={onClick}
    disabled={saving || !isAdmin}
    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    style={{
      background: saving || !isAdmin ? C.borderStrong : C.btnPrimary,
      color: '#FFFFFF',
      boxShadow: saving || !isAdmin ? 'none' : '0px 4px 12px rgba(8, 27, 67, 0.25)',
      fontFamily: "'Montserrat', sans-serif",
    }}
    onMouseEnter={(e) => { if (!saving && isAdmin) e.currentTarget.style.background = C.btnHover; }}
    onMouseLeave={(e) => { if (!saving && isAdmin) e.currentTarget.style.background = C.btnPrimary; }}
  >
    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
    {saving ? 'Saving…' : 'Save Changes'}
  </button>
);

const ResetBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
    style={{ border: `1px solid ${C.border}`, color: C.muted, background: C.card }}
    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.brand; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.color = C.muted; }}
  >
    <RotateCcw size={14} /> Reset
  </button>
);

const SectionHeader = ({ title, description, onReset, onSave, saving, isAdmin }) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>{title}</h2>
      <p className="text-sm mt-1" style={{ color: C.muted }}>{description}</p>
    </div>
    <div className="flex gap-2">
      <ResetBtn onClick={onReset} />
      <SaveButton onClick={onSave} saving={saving} isAdmin={isAdmin} />
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   PANEL COMPONENTS
   ════════════════════════════════════════════════════════════════════════════ */

const AppearancePanel = ({ appearance, setAppearance, save, saving, isAdmin, onReset }) => (
  <div>
    <SectionHeader
      title="Appearance Settings"
      description="Customize canvas defaults, grid and date/time display"
      onReset={onReset}
      onSave={() => save('appearance', appearance)}
      saving={saving}
      isAdmin={isAdmin}
    />

    <SectionCard title="Canvas Defaults" icon={Monitor} description="Default dimensions and background for new screens">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Default Background Color">
          <div className="flex gap-2">
            <input
              type="color"
              value={normalizeColor(appearance.canvasDefaultBg, '#ffffff')}
              onChange={(e) => setAppearance({ ...appearance, canvasDefaultBg: e.target.value })}
              className="h-10 w-14 rounded-lg cursor-pointer"
              style={{ border: `1px solid ${C.border}` }}
            />
            <Input
              value={appearance.canvasDefaultBg || ''}
              onChange={(e) => setAppearance({ ...appearance, canvasDefaultBg: e.target.value })}
              placeholder="#ffffff"
              disabled={!isAdmin}
            />
          </div>
        </FormField>

        <FormField label="Default Width (px)">
          <Input type="number" value={appearance.canvasDefaultWidth ?? ''}
            onChange={(e) => setAppearance({ ...appearance, canvasDefaultWidth: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={640} max={3840} disabled={!isAdmin} />
        </FormField>

        <FormField label="Default Height (px)">
          <Input type="number" value={appearance.canvasDefaultHeight ?? ''}
            onChange={(e) => setAppearance({ ...appearance, canvasDefaultHeight: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={480} max={2160} disabled={!isAdmin} />
        </FormField>

        <FormField label="Dashboard Refresh Rate (ms)" hint="How often live data refreshes on viewer">
          <Input type="number" value={appearance.dashboardRefreshRate ?? ''}
            onChange={(e) => setAppearance({ ...appearance, dashboardRefreshRate: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={200} max={60000} disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>

    <SectionCard title="Grid Settings" icon={Grid} description="Canvas editor grid behaviour">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Grid Size (px)">
          <Input type="number" value={appearance.gridSize ?? ''}
            onChange={(e) => setAppearance({ ...appearance, gridSize: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={5} max={100} disabled={!isAdmin} />
        </FormField>
        <FormField label="Show Grid by Default">
          <div className="flex items-center h-10">
            <Toggle checked={appearance.showGrid ?? true}
              onChange={(v) => setAppearance({ ...appearance, showGrid: v })} disabled={!isAdmin} />
            <span className="ml-3 text-sm" style={{ color: C.text }}>
              {appearance.showGrid ? 'Grid visible' : 'Grid hidden'}
            </span>
          </div>
        </FormField>
      </div>
    </SectionCard>

    <SectionCard title="Date & Time Format" icon={Clock} description="Global date and time display format">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Date Format">
          <Select value={appearance.dateFormat || 'DD/MM/YYYY'}
            onChange={(e) => setAppearance({ ...appearance, dateFormat: e.target.value })} disabled={!isAdmin}>
            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY (31-12-2025)</option>
          </Select>
        </FormField>

        <FormField label="Time Format">
          <Select value={appearance.timeFormat || '24h'}
            onChange={(e) => setAppearance({ ...appearance, timeFormat: e.target.value })} disabled={!isAdmin}>
            <option value="24h">24-Hour (14:30)</option>
            <option value="12h">12-Hour (02:30 PM)</option>
          </Select>
        </FormField>
      </div>

      <div className="mt-4 p-4 rounded-xl flex items-center gap-3"
        style={{ background: C.cardHover, border: `1px solid ${C.border}` }}>
        <Calendar size={16} style={{ color: C.brand }} />
        <span className="text-sm font-medium" style={{ color: C.heading }}>
          Preview:{' '}
          <span className="font-mono font-bold">
            {appearance.dateFormat === 'DD/MM/YYYY' ? '31/12/2025'
              : appearance.dateFormat === 'MM/DD/YYYY' ? '12/31/2025'
              : appearance.dateFormat === 'YYYY-MM-DD' ? '2025-12-31'
              : '31-12-2025'}{' '}
            {appearance.timeFormat === '24h' ? '14:30:00' : '02:30:00 PM'}
          </span>
        </span>
      </div>
    </SectionCard>
  </div>
);

const NotificationsPanel = ({ notifications, setNotifications, save, saving, isAdmin, onReset }) => (
  <div>
    <SectionHeader title="Notification Settings" description="Configure alerts, sounds and browser notifications"
      onReset={onReset} onSave={() => save('notifications', notifications)} saving={saving} isAdmin={isAdmin} />

    <SectionCard title="Alert Toggles" icon={Bell} description="Enable or disable alert channels">
      <ToggleRow label="Browser Notifications" hint="Show OS-level push notifications"
        checked={notifications.enableBrowserNotifications ?? true}
        onChange={(v) => setNotifications({ ...notifications, enableBrowserNotifications: v })} disabled={!isAdmin} />
      <ToggleRow label="Sound Alerts" hint="Play audio when alarms trigger"
        checked={notifications.enableSoundAlerts ?? true}
        onChange={(v) => setNotifications({ ...notifications, enableSoundAlerts: v })} disabled={!isAdmin} />
      <ToggleRow label="Critical Alarms Only" hint="Suppress non-critical alarm notifications"
        checked={notifications.criticalAlarmsOnly ?? false}
        onChange={(v) => setNotifications({ ...notifications, criticalAlarmsOnly: v })} disabled={!isAdmin} />
      <ToggleRow label="Show Success Messages" hint="Display confirmation toasts on successful actions"
        checked={notifications.showSuccessMessages ?? true}
        onChange={(v) => setNotifications({ ...notifications, showSuccessMessages: v })} disabled={!isAdmin} />
    </SectionCard>

    <SectionCard title="Sound & Timeout" icon={Volume2} description="Volume and display duration">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label={`Alarm Sound Volume — ${notifications.alarmSoundVolume ?? 70}%`}>
          <input type="range" min={0} max={100} value={notifications.alarmSoundVolume ?? 70}
            onChange={(e) => setNotifications({ ...notifications, alarmSoundVolume: parseInt(e.target.value) })}
            disabled={!isAdmin} className="w-full h-2 rounded-lg" style={{ accentColor: C.brand }} />
          <div className="flex justify-between text-xs mt-1" style={{ color: C.subtle }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </FormField>

        <FormField label="Notification Timeout (ms)" hint="How long notifications stay visible">
          <Input type="number" value={notifications.notificationTimeout ?? ''}
            onChange={(e) => setNotifications({ ...notifications, notificationTimeout: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1000} max={30000} disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>
  </div>
);

const SystemPanel = ({ system, setSystem, save, saving, isAdmin, onReset }) => (
  <div>
    <SectionHeader title="System Settings" description="Core system behaviour, polling and session control"
      onReset={onReset} onSave={() => save('system', system)} saving={saving} isAdmin={isAdmin} />

    <SectionCard title="Identity" icon={Globe} description="System and company branding">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="System Name">
          <Input value={system.systemName ?? ''} onChange={(e) => setSystem({ ...system, systemName: e.target.value })}
            placeholder="OnlineSCADA" disabled={!isAdmin} />
        </FormField>
        <FormField label="Company Name">
          <Input value={system.companyName ?? ''} onChange={(e) => setSystem({ ...system, companyName: e.target.value })}
            placeholder="Your Company" disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>

    <SectionCard title="Polling & Users" icon={Zap} description="PLC polling and concurrency limits">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Default Polling Rate (ms)" hint="How often tags are polled from PLCs">
          <Input type="number" value={system.defaultPollingRate ?? ''}
            onChange={(e) => setSystem({ ...system, defaultPollingRate: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={100} max={60000} disabled={!isAdmin} />
        </FormField>

        <FormField label="Session Timeout (minutes)">
          <Input type="number" value={system.sessionTimeout ?? ''}
            onChange={(e) => setSystem({ ...system, sessionTimeout: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={5} max={480} disabled={!isAdmin} />
        </FormField>

        <FormField label="Max Concurrent Users">
          <Input type="number" value={system.maxConcurrentUsers ?? ''}
            onChange={(e) => setSystem({ ...system, maxConcurrentUsers: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1} max={100} disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>

    <SectionCard title="Startup & Debug" icon={Activity} description="Auto start and developer options">
      <ToggleRow label="Auto Start PLCs on Boot" hint="Automatically connect PLCs when the server starts"
        checked={system.autoStartPLCs ?? true}
        onChange={(v) => setSystem({ ...system, autoStartPLCs: v })} disabled={!isAdmin} />
      <ToggleRow label="Enable Debug Mode" hint="Output verbose logs (not recommended in production)"
        checked={system.enableDebugMode ?? false}
        onChange={(v) => setSystem({ ...system, enableDebugMode: v })} disabled={!isAdmin} />
    </SectionCard>
  </div>
);

const DataManagementPanel = ({ dataManagement, setDataManagement, save, saving, isAdmin, onReset }) => (
  <div>
    <SectionHeader title="Data Management" description="Retention policies and automated cleanup"
      onReset={onReset} onSave={() => save('dataManagement', dataManagement)} saving={saving} isAdmin={isAdmin} />

    <SectionCard title="Retention Periods" icon={Database} description="How long historical data is kept">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Trend Data Retention (days)" hint="InfluxDB trend data older than this will be purged">
          <Input type="number" value={dataManagement.trendDataRetention ?? ''}
            onChange={(e) => setDataManagement({ ...dataManagement, trendDataRetention: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1} max={3650} disabled={!isAdmin} />
        </FormField>

        <FormField label="Alarm History Retention (days)" hint="Alarm records kept before automatic deletion">
          <Input type="number" value={dataManagement.alarmHistoryRetention ?? ''}
            onChange={(e) => setDataManagement({ ...dataManagement, alarmHistoryRetention: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1} max={3650} disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>

    <SectionCard title="Auto Cleanup" icon={Trash2} description="Scheduled data cleanup">
      <ToggleRow label="Enable Auto Cleanup" hint="Automatically delete data older than retention period"
        checked={dataManagement.autoCleanupEnabled ?? false}
        onChange={(v) => setDataManagement({ ...dataManagement, autoCleanupEnabled: v })} disabled={!isAdmin} />

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Cleanup Schedule">
          <Select value={dataManagement.cleanupSchedule || 'weekly'}
            onChange={(e) => setDataManagement({ ...dataManagement, cleanupSchedule: e.target.value })}
            disabled={!isAdmin || !dataManagement.autoCleanupEnabled}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </FormField>

        <FormField label="Last Cleanup">
          <div className="h-10 px-3 flex items-center rounded-xl text-sm"
            style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.muted }}>
            {dataManagement.lastCleanup ? new Date(dataManagement.lastCleanup).toLocaleString() : 'Never run'}
          </div>
        </FormField>
      </div>
    </SectionCard>
  </div>
);

const SecurityPanel = ({ security, setSecurity, save, saving, isAdmin, onReset }) => (
  <div>
    <SectionHeader title="Security Settings" description="Password policies, session and login protection"
      onReset={onReset} onSave={() => save('security', security)} saving={saving} isAdmin={isAdmin} />

    <SectionCard title="Password Policy" icon={Lock} description="Requirements for user passwords">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <FormField label="Minimum Password Length">
          <Input type="number" value={security.minPasswordLength ?? ''}
            onChange={(e) => setSecurity({ ...security, minPasswordLength: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={4} max={32} disabled={!isAdmin} />
        </FormField>
      </div>

      <ToggleRow label="Require Uppercase Letter" checked={security.requireUppercase ?? false}
        onChange={(v) => setSecurity({ ...security, requireUppercase: v })} disabled={!isAdmin} />
      <ToggleRow label="Require Numbers" checked={security.requireNumbers ?? false}
        onChange={(v) => setSecurity({ ...security, requireNumbers: v })} disabled={!isAdmin} />
      <ToggleRow label="Require Special Characters" checked={security.requireSpecialChars ?? false}
        onChange={(v) => setSecurity({ ...security, requireSpecialChars: v })} disabled={!isAdmin} />
    </SectionCard>

    <SectionCard title="Session & Lockout" icon={Timer} description="Session duration and brute-force protection">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Session Duration (hours)">
          <Input type="number" value={security.sessionDuration ?? ''}
            onChange={(e) => setSecurity({ ...security, sessionDuration: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1} max={168} disabled={!isAdmin} />
        </FormField>

        <FormField label="Max Login Attempts">
          <Input type="number" value={security.maxLoginAttempts ?? ''}
            onChange={(e) => setSecurity({ ...security, maxLoginAttempts: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={3} max={20} disabled={!isAdmin} />
        </FormField>

        <FormField label="Lockout Duration (minutes)">
          <Input type="number" value={security.lockoutDuration ?? ''}
            onChange={(e) => setSecurity({ ...security, lockoutDuration: e.target.value === '' ? '' : parseInt(e.target.value) })}
            min={1} max={1440} disabled={!isAdmin} />
        </FormField>
      </div>
    </SectionCard>
  </div>
);

const BackupPanel = ({
  backupOptions, setBackupOptions, handleExport, handleImport, fileInputRef,
  exportLoading, importLoading, isAdmin, setResetConfirm,
}) => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>Backup &amp; Restore</h2>
      <p className="text-sm mt-1" style={{ color: C.muted }}>
        Export or import all system data as a JSON backup file
      </p>
    </div>

    <SectionCard title="Export Backup" icon={Download} description="Download a JSON snapshot of your data">
      <div className="mb-4">
        <FormField label="Export Type">
          <Select value={backupOptions.type}
            onChange={(e) => setBackupOptions({ ...backupOptions, type: e.target.value })}>
            <option value="all">All Data</option>
            <option value="plcs">PLCs Only</option>
            <option value="tags">Tags Only</option>
            <option value="screens">Screens Only</option>
            <option value="settings">Settings Only</option>
            <option value="users">Users Only</option>
          </Select>
        </FormField>
      </div>

      <button
        onClick={handleExport}
        disabled={exportLoading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{
          background: exportLoading ? C.borderStrong : C.btnPrimary,
          color: '#FFFFFF',
          boxShadow: exportLoading ? 'none' : '0px 4px 12px rgba(8, 27, 67, 0.25)',
          fontFamily: "'Montserrat', sans-serif",
          cursor: exportLoading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!exportLoading) e.currentTarget.style.background = C.btnHover; }}
        onMouseLeave={(e) => { if (!exportLoading) e.currentTarget.style.background = C.btnPrimary; }}
      >
        {exportLoading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
        {exportLoading ? 'Exporting…' : 'Export Backup'}
      </button>
    </SectionCard>

    <SectionCard title="Import / Restore" icon={Upload}
      description="Restore data from a previously exported JSON file"
      action={
        <span className="text-xs px-2 py-1 rounded-lg font-semibold"
          style={{ background: 'rgba(220,38,38,0.10)', color: C.danger }}>
          Admin Only
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ['restorePLCs', 'PLCs'],
          ['restoreTags', 'Tags'],
          ['restoreScreens', 'Screens'],
          ['restoreSettings', 'Settings'],
        ].map(([key, label]) => (
          <label key={key}
            className="flex items-center gap-2 p-3 rounded-xl cursor-pointer"
            style={{ background: C.cardHover, border: `1px solid ${C.border}` }}>
            <input type="checkbox" checked={backupOptions[key]}
              onChange={(e) => setBackupOptions({ ...backupOptions, [key]: e.target.checked })}
              disabled={!isAdmin} style={{ accentColor: C.brand }} />
            <span className="text-sm font-medium" style={{ color: C.heading }}>{label}</span>
          </label>
        ))}
      </div>

      <ToggleRow label="Overwrite Existing Data" hint="Delete current data before importing (destructive)"
        checked={backupOptions.overwrite}
        onChange={(v) => setBackupOptions({ ...backupOptions, overwrite: v })} disabled={!isAdmin} />

      {backupOptions.overwrite && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-xl"
          style={{ background: 'rgba(220,38,38,0.07)', border: `1px solid rgba(220,38,38,0.20)` }}>
          <AlertTriangle size={14} style={{ color: C.danger }} className="shrink-0" />
          <p className="text-xs" style={{ color: '#7F1D1D' }}>
            Overwrite mode will permanently delete existing records before import.
          </p>
        </div>
      )}

      <div className="mt-4">
        <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importLoading || !isAdmin}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: C.cardSubtle,
            border: `1px solid ${C.border}`,
            color: C.heading,
          }}
        >
          {importLoading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
          {importLoading ? 'Importing…' : 'Choose Backup File…'}
        </button>
        <p className="text-xs mt-2" style={{ color: C.subtle }}>
          Only .json files exported by OnlineSCADA are supported
        </p>
      </div>
    </SectionCard>

    {isAdmin && (
      <SectionCard title="Factory Reset" icon={RotateCcw} description="Reset all settings to their default values">
        <p className="text-sm mb-4" style={{ color: C.text }}>
          This will reset every settings section back to its default. Your PLCs, tags and screens will NOT be affected.
        </p>
        <button
          onClick={() => setResetConfirm('all')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: 'rgba(220,38,38,0.10)',
            border: `1px solid rgba(220,38,38,0.25)`,
            color: C.danger,
          }}
        >
          <RotateCcw size={16} />
          Reset All Settings
        </button>
      </SectionCard>
    )}
  </div>
);

const AboutPanel = ({ systemInfo, loadSystemInfo }) => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>About &amp; System Info</h2>
      <p className="text-sm mt-1" style={{ color: C.muted }}>
        Application version and system statistics
      </p>
    </div>

    <SectionCard title="Application" icon={Package} description="OnlineSCADA version and build">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ['Version', systemInfo?.application?.version || '1.0.0'],
          ['Environment', systemInfo?.application?.environment || 'development'],
          ['Node.js', systemInfo?.application?.nodeVersion || '—'],
          ['Platform', systemInfo?.application?.platform || '—'],
        ].map(([label, val]) => (
          <div key={label} className="rounded-xl p-3 text-center"
            style={{ background: C.cardHover, border: `1px solid ${C.border}` }}>
            <p className="text-sm font-bold font-mono" style={{ color: C.heading }}>{val}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Hostname', systemInfo?.application?.hostname],
          ['Architecture', systemInfo?.application?.arch],
        ].map(([label, val]) => (
          val && (
            <div key={label} className="flex justify-between text-sm py-2"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span className="font-mono font-semibold" style={{ color: C.heading }}>{val}</span>
            </div>
          )
        ))}
      </div>
    </SectionCard>

    {systemInfo?.statistics && (
      <SectionCard title="Statistics" icon={Activity} description="System entity counts">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBadge label="Users" value={systemInfo.statistics.totalUsers} />
          <StatBadge label="PLCs" value={systemInfo.statistics.totalPLCs} />
          <StatBadge label="Active PLCs" value={systemInfo.statistics.activePLCs} color={C.success} />
          <StatBadge label="Tags" value={systemInfo.statistics.totalTags} />
          <StatBadge label="Screens" value={systemInfo.statistics.totalScreens} />
        </div>
      </SectionCard>
    )}

    <div className="flex justify-end">
      <button onClick={loadSystemInfo}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ border: `1px solid ${C.border}`, color: C.text, background: C.card }}>
        <RefreshCw size={14} />
        Refresh Info
      </button>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   MAIN SETTINGS COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const Settings = () => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [settings, setSettings] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(null);
  const [backupOptions, setBackupOptions] = useState({
    type: 'all',
    restorePLCs: true,
    restoreTags: true,
    restoreScreens: true,
    restoreSettings: true,
    overwrite: false,
  });
  const fileInputRef = useRef(null);

  const [appearance, setAppearance] = useState({});
  const [notifications, setNotifications] = useState({});
  const [system, setSystem] = useState({});
  const [dataManagement, setDataManagement] = useState({});
  const [security, setSecurity] = useState({});

  // Parse logged in user using multi-tenant structure ('userData' or legacy 'user' fallback)
  const getUser = () => {
    try {
      const userData = localStorage.getItem('userData') || localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      return null;
    }
  };

  const currentUser = getUser();
  const isAdmin = currentUser?.role === 'admin';

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts((p) => p.filter((t) => t.id !== id));

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.getAll();
      const data = res.data.data;
      setSettings(data);
      setAppearance(data.appearance || {});
      setNotifications(data.notifications || {});
      setSystem(data.system || {});
      setDataManagement(data.dataManagement || {});
      setSecurity(data.security || {});
    } catch (err) {
      addToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const res = await settingsAPI.getSystemInfo();
      setSystemInfo(res.data.data);
    } catch (err) {
      console.error('System info error:', err);
    }
  };

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, []);

  const saveSection = async (section, data) => {
    if (!isAdmin) {
      addToast('Admin access required', 'error');
      return;
    }
    try {
      setSaving(true);
      await settingsAPI.update(section, data);
      addToast(`${section} settings saved successfully`, 'success');
      await loadSettings();
    } catch (err) {
      addToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const res = await settingsAPI.exportBackup(backupOptions.type);
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onlinescada-backup-${backupOptions.type}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Backup exported successfully', 'success');
    } catch (err) {
      addToast('Export failed', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setImportLoading(true);
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await settingsAPI.importBackup(backup, {
        restorePLCs: backupOptions.restorePLCs,
        restoreTags: backupOptions.restoreTags,
        restoreScreens: backupOptions.restoreScreens,
        restoreSettings: backupOptions.restoreSettings,
        overwrite: backupOptions.overwrite,
      });
      const results = res.data.data;
      const restored = Object.entries(results.restored || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
      addToast(`Restored — ${restored}`, 'success');
      if (results.errors?.length) results.errors.forEach((e) => addToast(e, 'warning'));
      await loadSettings();
    } catch (err) {
      addToast('Import failed — invalid file', 'error');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async (section = null) => {
    try {
      await settingsAPI.reset(section);
      addToast(`${section ? section + ' settings' : 'All settings'} reset to defaults`, 'success');
      setResetConfirm(null);
      await loadSettings();
    } catch (err) {
      addToast('Reset failed', 'error');
    }
  };

  const navItems = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System', icon: Server },
    { id: 'dataManagement', label: 'Data Management', icon: Database },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'backup', label: 'Backup & Restore', icon: Package },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-center">
          <RefreshCw size={40} className="animate-spin mx-auto mb-4" style={{ color: C.brand }} />
          <p style={{ color: C.muted }}>Loading settings…</p>
        </div>
      </div>
    );
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearancePanel appearance={appearance} setAppearance={setAppearance}
          save={saveSection} saving={saving} isAdmin={isAdmin}
          onReset={() => setResetConfirm('appearance')} />;
      case 'notifications':
        return <NotificationsPanel notifications={notifications} setNotifications={setNotifications}
          save={saveSection} saving={saving} isAdmin={isAdmin}
          onReset={() => setResetConfirm('notifications')} />;
      case 'system':
        return <SystemPanel system={system} setSystem={setSystem}
          save={saveSection} saving={saving} isAdmin={isAdmin}
          onReset={() => setResetConfirm('system')} />;
      case 'dataManagement':
        return <DataManagementPanel dataManagement={dataManagement} setDataManagement={setDataManagement}
          save={saveSection} saving={saving} isAdmin={isAdmin}
          onReset={() => setResetConfirm('dataManagement')} />;
      case 'security':
        return <SecurityPanel security={security} setSecurity={setSecurity}
          save={saveSection} saving={saving} isAdmin={isAdmin}
          onReset={() => setResetConfirm('security')} />;
      case 'backup':
        return <BackupPanel backupOptions={backupOptions} setBackupOptions={setBackupOptions}
          handleExport={handleExport} handleImport={handleImport}
          fileInputRef={fileInputRef}
          exportLoading={exportLoading} importLoading={importLoading}
          isAdmin={isAdmin} setResetConfirm={setResetConfirm} />;
      case 'about':
        return <AboutPanel systemInfo={systemInfo} loadSystemInfo={loadSystemInfo} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: C.bg }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Reset Confirmation Modal */}
      {resetConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-2xl p-6 w-full max-w-sm mx-4"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)',
            }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(220, 38, 38, 0.10)' }}>
                <AlertTriangle size={20} style={{ color: C.danger }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>Confirm Reset</h3>
                <p className="text-xs" style={{ color: C.muted }}>This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm mb-6" style={{ color: C.text }}>
              {resetConfirm === 'all'
                ? 'Reset ALL settings to factory defaults?'
                : `Reset the "${resetConfirm}" section to defaults?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ border: `1px solid ${C.border}`, color: C.text, background: C.card }}>
                Cancel
              </button>
              <button onClick={() => resetConfirm === 'all' ? handleReset(null) : handleReset(resetConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: C.danger, color: '#FFFFFF' }}>
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header (fixed) ─── */}
      <div className="px-6 py-5 flex-shrink-0"
        style={{
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          boxShadow: '0px 1px 3px rgba(8, 27, 67, 0.03)',
        }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)` }}>
              <SettingsIcon size={20} color="#FFFFFF" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>System Settings</h1>
              <p className="text-xs" style={{ color: C.subtle }}>
                {isAdmin ? 'Administrator — full access' : 'Read-only — contact admin to make changes'}
              </p>
            </div>
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm"
              style={{ background: C.cardHover, color: C.muted }}>
              <Lock size={14} />
              View Only
            </div>
          )}
        </div>
      </div>

      {/* ─── Body (sidebar + scrollable main content) ─── */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full gap-6 p-6 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 overflow-y-auto">
          <nav className="space-y-1 sticky top-0">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={{
                    background: active ? `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)` : 'transparent',
                    color: active ? '#FFFFFF' : C.text,
                    boxShadow: active ? '0px 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.cardHover; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {active && <ChevronRight size={14} className="ml-auto" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ✅ SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default Settings;