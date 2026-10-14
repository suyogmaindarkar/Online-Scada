// Tag Management — protocol guidance and address validation

import React, { useState, useEffect, useRef } from 'react';
import { tagAPI, plcAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Tag, Plus, Edit2, Trash2, Search, Download, Upload,
  FileText, Loader2, Sparkles, Server, Info, AlertTriangle,
  CheckCircle2, HelpCircle, Layers, Database, Code, Lightbulb,
  ExternalLink, ArrowRight, RefreshCw, XCircle, Settings2, Wrench
} from 'lucide-react';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', cardSubtle: '#F8FAFC', cardHover: '#EEF6FF',
  border: '#E5E7EB', heading: '#081B43', text: '#334155', muted: '#5F6B7A',
  subtle: '#94A3B8', brand: '#2563EB', brandDark: '#0F3D91', btnPrimary: '#2563EB',
  btnHover: '#1D4ED8', success: '#16A34A', warning: '#F59E0B', danger: '#DC2626',
  purple: '#9333EA', teal: '#0891B2',
};

// ─── PROTOCOL-SPECIFIC ADDRESS GUIDANCE CONFIG ───
const PROTOCOL_GUIDE = {
  OPC_UA: {
    label: 'OPC-UA NodeID',
    badgeColor: C.purple,
    placeholder: 'ns=3;s="STAR_DELTA_DB"."START"',
    hint: 'OPC-UA uses NodeIDs. Format: ns=<namespace>;s="<Block>"."<Variable>"',
    examples: [
      { label: 'Siemens DB Bool', value: 'ns=3;s="STAR_DELTA_DB"."START"', type: 'BOOL' },
      { label: 'Siemens DB Real', value: 'ns=3;s="DB_Sensors"."Temperature"', type: 'REAL' },
      { label: 'Siemens DB DInt', value: 'ns=3;s="DB_Prod"."Counter"', type: 'DINT' },
      { label: 'Kepware / Ignition', value: 'ns=2;s=Channel1.Device1.Tag1', type: 'INT' },
      { label: 'Numeric NodeID', value: 'ns=2;i=1085', type: 'INT' },
    ],
    validate: (addr) => {
      if (!addr) return null;
      if (!/^(?:ns=\d+;)?(?:s=.+|i=\d+|g=[0-9a-f-]{8,}|b=[A-Za-z0-9+/=]+)$/i.test(addr.trim())) return 'Use a valid OPC UA NodeID such as ns=3;s="DB1"."Tag" or ns=2;i=1085.';
      return null;
    },
    tip: 'Tip: Use UAExpert (free tool) to browse your OPC-UA Server and copy the exact NodeId from Attributes.',
  },
  S7: {
    label: 'Siemens S7 Syntax',
    badgeColor: '#FF6B00',
    placeholder: 'DB1.DBD12 (REAL) or DB1.DBX0.0 (BOOL)',
    hint: 'S7 memory addresses: DBx.DBXy.z (Bit), DBx.DBWy (Word), DBx.DBDy (DWord/Real)',
    examples: [
      { label: 'Data Block Bit', value: 'DB1.DBX0.0', type: 'BOOL' },
      { label: 'Data Block Word', value: 'DB1.DBW2', type: 'INT' },
      { label: 'Data Block Real', value: 'DB1.DBD4', type: 'REAL' },
      { label: 'Data Block DInt', value: 'DB1.DBD8', type: 'DINT' },
      { label: 'Memory Flag Bit', value: 'M0.0', type: 'BOOL' },
    ],
    validate: (addr) => {
      if (!addr) return null;
      const upper = addr.trim().toUpperCase();
      if (!/^(?:DB\d+\.(?:DBX\d+\.\d+|DBB\d+|DBW\d+|DBD\d+)|DB\d+,(?:X\d+\.\d+|BYTE\d+|INT\d+|WORD\d+|DINT\d+|REAL\d+|DWORD\d+|S\d+(?:\.\d+)?)|[MIQ](?:[BWD]?\d+|\d+\.\d+))$/.test(upper)) return 'Use S7 syntax such as DB1.DBX0.0, DB1.DBW2, DB1.DBD4, DB1,REAL4, MW0, or M0.0.';
      const bit = /(?:DBX|,X|[MIQ])\d+\.(\d+)$/.exec(upper);
      if (bit && Number(bit[1]) > 7) return 'S7 bit offsets must be between 0 and 7.';
      return null;
    },
    tip: 'Tip: Ensure "Permit access with PUT/GET communication" is enabled in TIA Portal CPU settings.',
  },
  MODBUS_TCP: {
    label: 'Modbus TCP Register',
    badgeColor: C.brand,
    placeholder: '40001 (Holding Reg) or D0 (Delta PLC)',
    hint: 'Modbus 5-digit addresses: 0xxxx (Coils), 1xxxx (Discrete), 3xxxx (Input), 4xxxx (Holding)',
    examples: [
      { label: 'Holding Register', value: '40001', type: 'INT' },
      { label: 'Float (2 Regs)', value: '40003', type: 'REAL' },
      { label: 'Coil Bit', value: '00001', type: 'BOOL' },
      { label: 'Delta D0 Register', value: 'D0', type: 'INT' },
      { label: 'Delta M0 Relay', value: 'M0', type: 'BOOL' },
      { label: 'Delta Y0 Output', value: 'Y0', type: 'BOOL' },
      { label: 'Delta X0 Input', value: 'X0', type: 'BOOL' },
      { label: 'Delta T0 Timer', value: 'T0', type: 'INT' },
      { label: 'Delta C0 Counter', value: 'C0', type: 'INT' },
    ],
    validate: (addr) => {
      if (!addr) return null;
      if (!/^(0|1|3|4)\d{4}$/.test(addr.trim()) && !/^[DMXYTC]\d+$/.test(addr.trim().toUpperCase())) return 'Use a five-digit Modbus address (00001, 10001, 30001, or 40001) or a Delta device address such as D0, M0, X0, Y0, T0, or C0.';
      if (['00000', '10000', '30000', '40000'].includes(addr.trim())) return 'Modbus reference addresses start at 00001, 10001, 30001, or 40001.';
      return null;
    },
    tip: 'Copy the address from the equipment register map. Confirm Unit ID, data type, and word order. A readable register alone does not prove it is the intended signal.',
  },
  ETHERNET_IP: {
    label: 'Allen-Bradley CIP Tag',
    badgeColor: C.danger,
    placeholder: 'Motor1_Speed or N7:0 or B3:0/0',
    hint: 'ControlLogix uses CIP Tag Names (Motor1.Speed). MicroLogix uses files (N7:0, B3:0/0, F8:0)',
    examples: [
      { label: 'CIP Tag Name', value: 'Motor1_Speed', type: 'REAL' },
      { label: 'MicroLogix Integer', value: 'N7:0', type: 'INT' },
      { label: 'MicroLogix Bit', value: 'B3:0/0', type: 'BOOL' },
      { label: 'MicroLogix Float', value: 'F8:0', type: 'REAL' },
    ],
    validate: (addr) => {
      if (!addr) return null;
      if (!/^(?:Program:[A-Za-z_][\w]*\.)?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*(?::\d+)?(?:\/\d+)?$/.test(addr.trim())) return 'Use an exact tag name such as Motor1.Speed or Program:MainProgram.Speed. Legacy file syntax requires a compatible controller driver.';
      return null;
    },
    tip: 'Tip: For MicroLogix 1400, enable Modbus TCP mapping in RSLogix 500 Channel Configuration.',
  },
  SIMULATION: {
    label: 'Simulation Pattern',
    badgeColor: C.purple,
    placeholder: 'SIM_TEMPERATURE',
    hint: 'Virtual simulation tags generated internally in memory',
    examples: [
      { label: 'Temperature Sine', value: 'SIM_TEMPERATURE', type: 'REAL' },
      { label: 'Pressure Walk', value: 'SIM_PRESSURE', type: 'REAL' },
      { label: 'Level Ramp', value: 'SIM_LEVEL', type: 'REAL' },
      { label: 'Motor Toggle', value: 'SIM_MOTOR_RUN', type: 'BOOL' },
      { label: 'Counter Inc', value: 'SIM_COUNTER', type: 'INT' },
    ],
    validate: (addr) => addr && !(/^(?:SIM_[A-Z][A-Z0-9_]*|(?:0|1|3|4)\d{4})$/.test(addr.trim().toUpperCase())) ? 'Use a simulation name such as SIM_TEMPERATURE or the reserved demo address 40001.' : null,
    tip: 'Simulation tags use generated values. New tags should use a SIM_ name; existing demo tags may retain reserved addresses such as 40001.',
  },
  PROFIBUS: {
    label: 'Profibus Address', badgeColor: C.teal,
    placeholder: 'DB1.DBW2 or 40001',
    hint: 'Use the address syntax exposed by the selected Profibus gateway mapping.',
    examples: [
      { label: 'Mapped S7 Word', value: 'DB1.DBW2', type: 'INT' },
      { label: 'Mapped Holding Register', value: '40001', type: 'INT' },
      { label: 'Mapped Bit', value: 'DB1.DBX0.0', type: 'BOOL' },
    ],
    validate: (addr) => addr && !(/^(DB\d+\.(DBX\d+\.\d+|DBB\d+|DBW\d+|DBD\d+)|[0-4]\d{4})$/.test(addr.trim().toUpperCase())) ? 'Use the address format configured by the gateway, such as DB1.DBW2, DB1.DBX0.0, or 40001.' : null,
    tip: 'Profibus devices are accessed through the selected gateway. Confirm whether its mapping uses S7 byte addresses or Modbus registers.',
  },
};

const ACCESS_LABELS = { READ: 'Read', WRITE: 'Write', READ_WRITE: 'Read/Write' };

const TagManagement = () => {
  const { showToast } = useToast();

  const [tags, setTags] = useState([]);
  const [plcs, setPlcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPlcFilter, setSelectedPlcFilter] = useState('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    tagName: '', description: '', plcConnection: '',
    plcAddress: '', dataType: 'BOOL', accessType: 'READ_WRITE',
    unit: '', minValue: 0, maxValue: 100, enableLogging: false,
  });
  const [addressBuilder, setAddressBuilder] = useState({
    show: false,
    s7: { area: 'DB', dbNumber: 1, byteOffset: 0, bitOffset: 0 },
    modbus: { area: 'holding', index: 1, deltaName: 'D0' },
    opcua: { type: 's', namespace: 3, identifier: '' },
    ethernetIp: { scope: 'controller', tagName: '', program: 'MainProgram' },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tagsRes, plcsRes] = await Promise.all([
        tagAPI.getAll(),
        plcAPI.getAll(),
      ]);
      setTags(tagsRes.data.data || []);
      setPlcs(plcsRes.data.data || []);
    } catch (err) {
      showToast('Failed to load tags or PLCs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Find currently selected PLC in modal
  const selectedPLC = plcs.find(p => p._id === formData.plcConnection);
  const rawProtocol = String(selectedPLC?.protocol || 'SIMULATION').toUpperCase();
  const transportProtocol = String(selectedPLC?.transportProtocol || rawProtocol).toUpperCase();
  const isProfibusGateway = rawProtocol === 'PROFIBUS_GATEWAY';
  const transportGuideKey = isProfibusGateway
    ? (transportProtocol.includes('MODBUS') ? 'MODBUS_TCP'
      : transportProtocol.includes('OPC') ? 'OPC_UA'
        : transportProtocol.includes('ETHERNET') ? 'ETHERNET_IP' : 'PROFIBUS')
    : rawProtocol.includes('MODBUS') ? 'MODBUS_TCP'
      : rawProtocol.includes('OPC') ? 'OPC_UA'
        : rawProtocol.includes('ETHERNET') ? 'ETHERNET_IP'
          : rawProtocol.includes('SIMULATION') ? 'SIMULATION' : rawProtocol;
  const normProtocol = transportGuideKey;
  const baseGuide = PROTOCOL_GUIDE[normProtocol] || PROTOCOL_GUIDE.MODBUS_TCP;
  const guide = isProfibusGateway
    ? { ...baseGuide, label: `Profibus via ${transportProtocol.replace('_', ' ')}`, tip: `This Profibus connection uses a ${transportProtocol.replace('_', ' ')} gateway. Enter the address exposed by that gateway, not the physical Profibus station number.` }
    : baseGuide;
  let addressWarning = guide.validate(formData.plcAddress);
  const compatibilityWarnings = [];
  const address = formData.plcAddress.trim().toUpperCase();
  if (normProtocol === 'S7' && /(?:DBX|,X|[MIQ])\d+\.\d+$/.test(address) && formData.dataType !== 'BOOL') addressWarning = 'An S7 bit address requires BOOL.';
  if (normProtocol === 'MODBUS_TCP' || normProtocol === 'MODBUS_RTU' || normProtocol === 'DELTA') {
    if (/^(?:[01]\d{4}|[MXY]\d+)$/.test(address) && formData.dataType !== 'BOOL') addressWarning = 'Coils and discrete inputs require BOOL.';
    if (/^(?:[13]\d{4}|X\d+)$/.test(address) && formData.accessType !== 'READ') addressWarning = 'Input addresses are read-only. Select Read access.';
    if (formData.dataType === 'STRING') addressWarning = 'Text decoding is not supported by the current Modbus reader.';
    if (['REAL', 'DINT', 'DWORD'].includes(formData.dataType) && ['39999', '49999'].includes(address)) addressWarning = 'This 32-bit value needs two registers within the supported area.';
  }
  if (formData.dataType === 'BOOL' && normProtocol === 'MODBUS_TCP' && /^\d{5}$/.test(address) && !address.startsWith('0') && !address.startsWith('1')) compatibilityWarnings.push('BOOL is normally mapped to a coil or discrete input (00001 or 10001), not a register address.');
  if (['REAL', 'DINT', 'DWORD'].includes(formData.dataType) && normProtocol === 'MODBUS_TCP' && /^[0134]\d{4}$/.test(address)) compatibilityWarnings.push(`${formData.dataType} uses two Modbus registers; verify the gateway word order and register span.`);
  if (normProtocol === 'S7' && address.startsWith('DBX') && formData.dataType !== 'BOOL') compatibilityWarnings.push('DBX is a bit address and is compatible with BOOL only.');
  if (normProtocol === 'S7' && /DB[WB]\d+$/.test(address) && ['BOOL', 'REAL', 'DINT', 'DWORD'].includes(formData.dataType)) compatibilityWarnings.push('This S7 address width may not match the selected data type; use DBX for BOOL, DBW for 16-bit values, or DBD for 32-bit values.');
  if (normProtocol === 'SIMULATION' && formData.dataType === 'STRING') compatibilityWarnings.push('Simulation patterns currently generate numeric or boolean values; verify STRING support before saving.');
   if (isProfibusGateway && transportProtocol.includes('MODBUS') && !/^(?:0|1|3|4)\d{4}$/.test(address) && !/^[DMXYTC]\d+$/.test(address)) compatibilityWarnings.push('This Profibus gateway exposes Modbus mapping; use a five-digit register or supported Delta address.');
   if (isProfibusGateway && transportProtocol.includes('S7') && !/^DB\d+\./.test(address)) compatibilityWarnings.push('This Profibus gateway exposes S7 mapping; use a DB address such as DB1.DBW2.');

  // ─── ADDRESS BUILDER HELPERS (Phase 2A) ───────────────
  // Which helper applies for the currently selected PLC (or Profibus transport).
  const builderHelperFor = () => {
    const rp = String(selectedPLC?.protocol || '').toUpperCase();
    const tp = String(selectedPLC?.transportProtocol || rp).toUpperCase();
    if (rp === 'PROFIBUS_GATEWAY') {
      if (tp.includes('OPC')) return 'OPC_UA';
      if (tp.includes('ETHERNET')) return 'ETHERNET_IP';
      if (tp.includes('MODBUS')) return 'MODBUS';
      return null;
    }
    if (rp.includes('S7')) return 'S7';
    if (rp.includes('MODBUS') || rp.includes('DELTA') || rp.includes('SIMULATION')) return 'MODBUS';
    if (rp.includes('OPC')) return 'OPC_UA';
    if (rp.includes('ETHERNET')) return 'ETHERNET_IP';
    return null;
  };
  const builderHelper = builderHelperFor();

  // Generate the address string from the active builder fields.
  const buildAddress = (helper) => {
    if (helper === 'S7') {
      const { area, dbNumber, byteOffset, bitOffset } = addressBuilder.s7;
      if (area === 'DB') {
        const type = formData.dataType || 'BOOL';
        if (type === 'BOOL') return `DB${dbNumber}.DBX${byteOffset}.${bitOffset}`;
        if (type === 'BYTE') return `DB${dbNumber}.DBB${byteOffset}`;
        if (type === 'INT' || type === 'WORD') return `DB${dbNumber}.DBW${byteOffset}`;
        return `DB${dbNumber}.DBD${byteOffset}`;
      }
      // M / I / Q are bit addressing (BOOL)
      return `${area}${byteOffset}.${bitOffset}`;
    }
    if (helper === 'MODBUS') {
      const { area, index, deltaName } = addressBuilder.modbus;
      if (area !== 'coil' && area !== 'discrete' && area !== 'input' && area !== 'holding') return deltaName; // Delta name
      const prefix = area === 'coil' ? 0 : area === 'discrete' ? 1 : area === 'input' ? 3 : 4;
      return String(prefix) + String(Math.max(1, Number(index) || 1)).padStart(4, '0');
    }
    if (helper === 'OPC_UA') {
      const { type, namespace, identifier } = addressBuilder.opcua;
      if (!identifier) return '';
      return `ns=${namespace};${type}=${identifier}`;
    }
    if (helper === 'ETHERNET_IP') {
      const { scope, tagName, program } = addressBuilder.ethernetIp;
      if (!tagName) return '';
      return scope === 'program' ? `Program:${program}.${tagName}` : tagName;
    }
    return '';
  };

  const applyBuilderAddress = () => {
    const addr = buildAddress(builderHelper).trim();
    if (!addr) { showToast('Complete the address fields before generating', 'warning'); return; }
    let inferredType = formData.dataType;
    let inferredAccess = formData.accessType;
    if (builderHelper === 'S7') {
      const a = addressBuilder.s7.area;
      if (a === 'M' || a === 'I' || a === 'Q') inferredType = 'BOOL';
      else inferredType = addressBuilder.s7.bitOffset >= 0 && !formData.dataType ? 'BOOL' : formData.dataType;
      // DBX always BOOL
      if (a === 'DB') {
        const type = formData.dataType || 'BOOL';
        inferredType = type === 'BOOL' ? 'BOOL' : type;
      }
    } else if (builderHelper === 'MODBUS') {
      const a = addressBuilder.modbus.area;
      if (['coil', 'discrete'].includes(a)) inferredType = 'BOOL';
      if (['deltaM', 'deltaX', 'deltaY'].includes(a)) inferredType = 'BOOL';
      if (['discrete', 'input', 'deltaX'].includes(a)) inferredAccess = 'READ';
    }
    setFormData((prev) => ({ ...prev, plcAddress: addr, dataType: inferredType, accessType: inferredAccess }));
    showToast('Address generated and filled', 'success');
  };

  const openBuilder = () => {
    if (!builderHelper) { showToast('Address builder is not available for this protocol', 'info'); return; }
    setAddressBuilder((b) => ({ ...b, show: !b.show }));
  };

  const handleOpenAdd = () => {
    setEditingTag(null);
    const defaultPlc = plcs[0]?._id || '';
    setFormData({
      tagName: '', description: '', plcConnection: defaultPlc,
      plcAddress: '', dataType: 'BOOL', accessType: 'READ_WRITE',
      unit: '', minValue: 0, maxValue: 100, enableLogging: false,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (tag) => {
    setEditingTag(tag);
    setFormData({
      tagName: tag.tagName,
      description: tag.description || '',
      plcConnection: tag.plcConnection?._id || tag.plcConnection || '',
      plcAddress: tag.plcAddress || '',
      dataType: tag.dataType || 'BOOL',
      accessType: tag.accessType === 'READ_ONLY' ? 'READ' : (tag.accessType || 'READ_WRITE'),
      unit: tag.unit || '',
      minValue: tag.minValue ?? 0,
      maxValue: tag.maxValue ?? 100,
      enableLogging: !!tag.enableLogging,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plcConnection) {
      showToast('Please select a PLC connection', 'warning');
      return;
    }
    if (addressWarning) {
      showToast(addressWarning, 'warning');
      return;
    }
    try {
      let response;
      if (editingTag) {
        response = await tagAPI.update(editingTag._id, formData);
      } else {
        response = await tagAPI.create(formData);
      }
      const backendWarnings = response?.data?.warnings || [];
      backendWarnings.forEach((w) => showToast(w, 'warning', 6000));
      showToast(`Tag "${formData.tagName}" ${editingTag ? 'updated' : 'created'}`, 'success');
      setShowModal(false);
      loadData();
    } catch (err) {
      const data = err.response?.data;
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        data.warnings.forEach((w) => showToast(w, 'warning', 6000));
      }
      showToast(data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await tagAPI.delete(deleteId);
      setDeleteId(null);
      loadData();
      showToast('Tag deleted', 'success');
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  const filteredTags = tags.filter(t => {
    const matchesSearch = t.tagName.toLowerCase().includes(search.toLowerCase()) ||
      (t.plcAddress && t.plcAddress.toLowerCase().includes(search.toLowerCase()));
    const matchesPlc = selectedPlcFilter === 'ALL' ||
      (t.plcConnection?._id || t.plcConnection) === selectedPlcFilter;
    return matchesSearch && matchesPlc;
  });

  return (
    <div className="space-y-4 font-sans text-slate-800 pb-10">

      {/* HEADER */}
      <div className="p-5 rounded-2xl bg-white border shadow-sm flex items-center justify-between flex-wrap gap-4" style={{ borderColor: C.border }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.heading }}>Tag Management</h1>
          <p className="text-sm text-slate-500 mt-1">Configure data points and link PLC addresses to SCADA variables</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer"
            style={{ background: C.btnPrimary }}>
            <Plus size={16} /> Add New Tag
          </button>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="p-4 rounded-xl bg-white border shadow-sm flex items-center justify-between flex-wrap gap-3" style={{ borderColor: C.border }}>
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags by name or PLC address..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border bg-slate-50 outline-none focus:border-blue-500"
            style={{ borderColor: C.border }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter by Equipment:</span>
          <select
            value={selectedPlcFilter}
            onChange={(e) => setSelectedPlcFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-semibold border bg-slate-50 outline-none"
            style={{ borderColor: C.border }}
          >
            <option value="ALL">All Equipment ({tags.length})</option>
            {plcs.map(p => (
              <option key={p._id} value={p._id}>{p.name} ({p.protocol})</option>
            ))}
          </select>
        </div>
      </div>

      {/* TAGS TABLE */}
      <div className="rounded-2xl bg-white border shadow-sm overflow-hidden" style={{ borderColor: C.border }}>
        {loading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : filteredTags.length === 0 ? (
          <div className="py-16 text-center">
            <Tag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-800">No Tags Found</h3>
            <p className="text-xs text-slate-500 mb-4">Add your first tag or adjust your search filter.</p>
            <button onClick={handleOpenAdd} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs">Add Tag</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="p-4">Tag Name</th>
                  <th className="p-4">Equipment</th>
                  <th className="p-4">PLC Address</th>
                  <th className="p-4">Data Type</th>
                  <th className="p-4">Live Value</th>
                  <th className="p-4">Access</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTags.map(tag => {
                  const plcObj = plcs.find(p => p._id === (tag.plcConnection?._id || tag.plcConnection));
                  return (
                    <tr key={tag._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{tag.tagName}</span>
                          {tag.isSimulationTag && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                              <Sparkles size={10} /> SIM
                            </span>
                          )}
                        </div>
                        {tag.description && <p className="text-xs text-slate-400 mt-0.5">{tag.description}</p>}
                      </td>
                      <td className="p-4 font-medium text-slate-700">{plcObj?.name || 'Unlinked'}</td>
                      <td className="p-4 font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block my-2">{tag.plcAddress || '—'}</td>
                      <td className="p-4 font-mono text-xs font-semibold text-slate-600">{tag.dataType}</td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-800 border">
                          {tag.currentValue !== undefined && tag.currentValue !== null ? String(tag.currentValue) : 'null'}
                          {tag.unit && <span className="ml-1 text-slate-500 font-normal">{tag.unit}</span>}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-500">{ACCESS_LABELS[tag.accessType] || tag.accessType}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleOpenEdit(tag)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={15} /></button>
                          <button onClick={() => setDeleteId(tag._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ ADD / EDIT TAG MODAL WITH PROTOCOL SYNTAX HELPER ═══ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingTag ? 'Edit Tag' : 'Add New Tag'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Tag Name *</label>
              <input
                type="text" required
                value={formData.tagName}
                onChange={e => setFormData({ ...formData, tagName: e.target.value })}
                placeholder="e.g. MOTOR_RUN_STATUS"
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Equipment (PLC) *</label>
              <select
                value={formData.plcConnection}
                onChange={e => setFormData({ ...formData, plcConnection: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 outline-none focus:border-blue-500 font-semibold"
              >
                <option value="" disabled>Select Equipment...</option>
                {plcs.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.protocol})</option>
                ))}
              </select>
            </div>
          </div>

          {/* SMART PROTOCOL-AWARE PLC ADDRESS SECTION */}
          <div className="p-4 rounded-xl border bg-slate-50 space-y-3" style={{ borderColor: C.border }}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Code size={14} className="text-blue-600" /> PLC Address (Memory / Register / NodeID) *
              </label>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: guide.badgeColor }}>
                {guide.label}
              </span>
            </div>

            <input
              type="text" required
              value={formData.plcAddress}
              onChange={e => setFormData({ ...formData, plcAddress: e.target.value })}
              placeholder={`e.g. ${guide.placeholder}`}
              className="w-full p-2.5 border rounded-xl font-mono text-sm bg-white outline-none focus:border-blue-500 font-bold text-blue-900"
            />

            {/* LIVE SYNTAX WARNING IF FORMAT IS MISMATCHED */}
            {addressWarning && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2 items-start">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span>{addressWarning}</span>
              </div>
            )}

            {compatibilityWarnings.map((warning) => (
              <div key={warning} className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex gap-2 items-start">
                <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <span>{warning}</span>
              </div>
            ))}

            {/* CLICK-TO-FILL QUICK EXAMPLES */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                <Lightbulb size={12} className="text-amber-500" /> Click an example to auto-fill address:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {guide.examples.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, plcAddress: ex.value, dataType: ex.type, accessType: normProtocol === 'MODBUS_TCP' && /^(?:[13]\d{4}|X\d+)$/i.test(ex.value) ? 'READ' : formData.accessType })}
                    className="px-2 py-1 rounded-lg text-[11px] font-mono border bg-white hover:bg-blue-50 hover:border-blue-300 transition-all text-slate-700 cursor-pointer flex items-center gap-1"
                  >
                    <span>{ex.label}:</span>
                    <span className="font-bold text-blue-600">{ex.value}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* HELPER TIP */}
            <p className="text-[11px] text-slate-500 italic leading-relaxed pt-1 border-t border-slate-200">
              {guide.tip}
            </p>

            {/* ADDRESS BUILDER TOGGLE (Phase 2A) */}
            {builderHelper && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={openBuilder}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  style={{ background: addressBuilder.show ? '#EEF2FF' : '#EFF6FF', color: C.brandDark, border: '1px solid #BFDBFE' }}
                >
                  <Settings2 size={14} /> {addressBuilder.show ? 'Hide Address Builder' : 'Build Address with Helper'}
                </button>
              </div>
            )}

            {addressBuilder.show && builderHelper && (
              <div className="p-4 rounded-xl border border-blue-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <Wrench size={13} className="text-blue-600" /> Address Builder &mdash; {guide.label}
                  </p>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Preview: {buildAddress(builderHelper) || '—'}
                  </span>
                </div>

                {builderHelper === 'S7' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Area</label>
                      <select
                        value={addressBuilder.s7.area}
                        onChange={e => setAddressBuilder({ ...addressBuilder, s7: { ...addressBuilder.s7, area: e.target.value } })}
                        className="w-full p-2 rounded-lg text-xs border bg-slate-50 outline-none"
                      >
                        <option value="DB">Data Block</option>
                        <option value="M">Memory</option>
                        <option value="I">Input</option>
                        <option value="Q">Output</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Data Block number</label>
                      <input
                        type="number" min="1"
                        value={addressBuilder.s7.dbNumber}
                        onChange={e => setAddressBuilder({ ...addressBuilder, s7: { ...addressBuilder.s7, dbNumber: Number(e.target.value) || 1 } })}
                        className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Byte offset</label>
                      <input
                        type="number" min="0"
                        value={addressBuilder.s7.byteOffset}
                        onChange={e => setAddressBuilder({ ...addressBuilder, s7: { ...addressBuilder.s7, byteOffset: Number(e.target.value) || 0 } })}
                        className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Bit offset (0-7)</label>
                      <input
                        type="number" min="0" max="7"
                        value={addressBuilder.s7.bitOffset}
                        onChange={e => { const v = Math.min(7, Math.max(0, Number(e.target.value) || 0)); setAddressBuilder({ ...addressBuilder, s7: { ...addressBuilder.s7, bitOffset: v } }); }}
                        className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                      />
                    </div>
                  </div>
                )}

                {builderHelper === 'MODBUS' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Memory area</label>
                      <select
                        value={addressBuilder.modbus.area}
                        onChange={e => setAddressBuilder({ ...addressBuilder, modbus: { ...addressBuilder.modbus, area: e.target.value } })}
                        className="w-full p-2 rounded-lg text-xs border bg-slate-50 outline-none"
                      >
                        <option value="coil">Coil (00001)</option>
                        <option value="discrete">Discrete Input (10001)</option>
                        <option value="input">Input Register (30001)</option>
                        <option value="holding">Holding Register (40001)</option>
                        <option value="deltaD">Delta D</option>
                        <option value="deltaM">Delta M</option>
                        <option value="deltaX">Delta X</option>
                        <option value="deltaY">Delta Y</option>
                        <option value="deltaT">Delta T</option>
                        <option value="deltaC">Delta C</option>
                      </select>
                    </div>
                    <div>
                      {['deltaD','deltaM','deltaX','deltaY','deltaT','deltaC'].includes(addressBuilder.modbus.area) ? (
                        <>
                          <label className="block text-[10px] font-bold mb-1">Delta address</label>
                          <input
                            type="text"
                            value={addressBuilder.modbus.deltaName}
                            onChange={e => setAddressBuilder({ ...addressBuilder, modbus: { ...addressBuilder.modbus, deltaName: e.target.value.toUpperCase() } })}
                            placeholder="e.g. D0, M0, X0"
                            className="w-full p-2 rounded-lg text-xs border bg-white font-mono outline-none"
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-[10px] font-bold mb-1">Register / bit number (1 based)</label>
                          <input
                            type="number" min="1"
                            value={addressBuilder.modbus.index}
                            onChange={e => setAddressBuilder({ ...addressBuilder, modbus: { ...addressBuilder.modbus, index: Number(e.target.value) || 1 } })}
                            className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {builderHelper === 'OPC_UA' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1">NodeID type</label>
                      <select
                        value={addressBuilder.opcua.type}
                        onChange={e => setAddressBuilder({ ...addressBuilder, opcua: { ...addressBuilder.opcua, type: e.target.value } })}
                        className="w-full p-2 rounded-lg text-xs border bg-slate-50 outline-none"
                      >
                        <option value="s">String</option>
                        <option value="i">Numeric</option>
                        <option value="g">GUID</option>
                        <option value="b">Byte string</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Namespace index</label>
                      <input
                        type="number" min="0"
                        value={addressBuilder.opcua.namespace}
                        onChange={e => setAddressBuilder({ ...addressBuilder, opcua: { ...addressBuilder.opcua, namespace: Number(e.target.value) || 0 } })}
                        className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold mb-1">Identifier</label>
                      <input
                        type="text"
                        value={addressBuilder.opcua.identifier}
                        onChange={e => setAddressBuilder({ ...addressBuilder, opcua: { ...addressBuilder.opcua, identifier: e.target.value } })}
                        placeholder="e.g. Channel1.Device1.Temperature"
                        className="w-full p-2 rounded-lg text-xs border bg-white font-mono outline-none"
                      />
                    </div>
                  </div>
                )}

                {builderHelper === 'ETHERNET_IP' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1">Tag scope</label>
                      <select
                        value={addressBuilder.ethernetIp.scope}
                        onChange={e => setAddressBuilder({ ...addressBuilder, ethernetIp: { ...addressBuilder.ethernetIp, scope: e.target.value } })}
                        className="w-full p-2 rounded-lg text-xs border bg-slate-50 outline-none"
                      >
                        <option value="controller">Controller tag</option>
                        <option value="program">Program tag</option>
                      </select>
                    </div>
                    {addressBuilder.ethernetIp.scope === 'program' && (
                      <div>
                        <label className="block text-[10px] font-bold mb-1">Program name</label>
                        <input
                          type="text"
                          value={addressBuilder.ethernetIp.program}
                          onChange={e => setAddressBuilder({ ...addressBuilder, ethernetIp: { ...addressBuilder.ethernetIp, program: e.target.value } })}
                          placeholder="MainProgram"
                          className="w-full p-2 rounded-lg text-xs border bg-white outline-none"
                        />
                      </div>
                    )}
                    <div className={addressBuilder.ethernetIp.scope === 'program' ? '' : 'col-span-2'}>
                      <label className="block text-[10px] font-bold mb-1">Tag name</label>
                      <input
                        type="text"
                        value={addressBuilder.ethernetIp.tagName}
                        onChange={e => setAddressBuilder({ ...addressBuilder, ethernetIp: { ...addressBuilder.ethernetIp, tagName: e.target.value } })}
                        placeholder="e.g. Motor:Speed"
                        className="w-full p-2 rounded-lg text-xs border bg-white font-mono outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeBuilder}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-500 cursor-pointer hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={applyBuilderAddress}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-sm"
                    style={{ background: C.btnPrimary }}
                  >
                    <span className="inline-flex items-center gap-1"><ArrowRight size={12} />Fill Address</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Data Type *</label>
              <select
                value={formData.dataType}
                onChange={e => setFormData({ ...formData, dataType: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 outline-none font-semibold"
              >
                <option value="BOOL">BOOL (Boolean True/False)</option>
                <option value="INT">INT (16-bit Signed Integer)</option>
                <option value="DINT">DINT (32-bit Signed Integer)</option>
                <option value="REAL">REAL (32-bit Float)</option>
                <option value="WORD">WORD (16-bit Unsigned)</option>
                <option value="DWORD">DWORD (32-bit Unsigned)</option>
                <option value="BYTE">BYTE (8-bit)</option>
                <option value="STRING">STRING (Text)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Access Type</label>
              <select
                value={formData.accessType}
                onChange={e => setFormData({ ...formData, accessType: e.target.value })}
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 outline-none font-semibold"
              >
                <option value="READ">Read (Display Only)</option>
                <option value="WRITE">Write (Command Only)</option>
                <option value="READ_WRITE">Read / Write (Full Control)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Unit (Optional)</label>
              <input
                type="text"
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. °C, bar, %"
                className="w-full p-2 border rounded-xl text-sm bg-slate-50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Min Value</label>
              <input
                type="number"
                value={formData.minValue}
                onChange={e => setFormData({ ...formData, minValue: parseFloat(e.target.value) })}
                className="w-full p-2 border rounded-xl text-sm bg-slate-50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Max Value</label>
              <input
                type="number"
                value={formData.maxValue}
                onChange={e => setFormData({ ...formData, maxValue: parseFloat(e.target.value) })}
                className="w-full p-2 border rounded-xl text-sm bg-slate-50 outline-none"
              />
            </div>
          </div>

          <button type="submit" className="w-full p-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md mt-2 cursor-pointer">
            {editingTag ? 'Update Tag' : 'Save Tag'}
          </button>
        </form>
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Tag?"
        message="Are you sure you want to delete this tag? Any HMI screen widgets bound to this tag will stop receiving live data."
        confirmText="Delete Tag"
        confirmColor="red"
        icon="warning"
      />

    </div>
  );
};

export default TagManagement;
