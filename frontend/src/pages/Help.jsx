// ═══════════════════════════════════════════════════════════
// Help & Documentation Page — Full Guide for OnlineSCADA Users
// ═══════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import {
    HelpCircle, Search, ChevronRight, Book, Cpu, Zap, Server,
    Network, Download, AlertCircle, CheckCircle, Info, Play,
    Settings as SettingsIcon, Users, BarChart, Bell, Terminal,
    FolderArchive, KeyRound, Wifi, WifiOff, ChevronDown,
    ClipboardCheck, FileWarning, ExternalLink, Wrench, LayoutDashboard
} from 'lucide-react';

const C = {
    bg: '#F8FAFC', card: '#FFFFFF', border: '#E5E7EB',
    heading: '#081B43', text: '#334155', muted: '#5F6B7A', subtle: '#94A3B8',
    brand: '#2563EB', brandDark: '#0F3D91', success: '#16A34A',
    warning: '#F59E0B', danger: '#DC2626', purple: '#9333EA',
};

// ─── Section Component ───
const Section = ({ id, icon: Icon, title, children, color = C.brand }) => (
    <section id={id} className="scroll-mt-6">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, color: color }}>
                <Icon size={20} />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: C.heading }}>{title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
    </section>
);

// ─── Sub-Card ───
const Card = ({ title, children, badge, badgeColor = C.brand }) => (
    <div className="rounded-xl border p-5" style={{ background: C.card, borderColor: C.border }}>
        {title && (
            <div className="flex items-center gap-2 mb-3">
                <h3 className="font-bold text-lg" style={{ color: C.heading }}>{title}</h3>
                {badge && <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ background: `${badgeColor}20`, color: badgeColor }}>{badge}</span>}
            </div>
        )}
        <div className="text-sm leading-relaxed space-y-2" style={{ color: C.text }}>{children}</div>
    </div>
);

// ─── Alert Box ───
const Alert = ({ type = 'info', title, children }) => {
    const styles = {
        info: { bg: '#EFF6FF', border: '#93C5FD', color: '#1E40AF', icon: Info },
        success: { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D', icon: CheckCircle },
        warning: { bg: '#FEF3C7', border: '#FDE68A', color: '#B45309', icon: AlertCircle },
        danger: { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', icon: FileWarning },
    };
    const s = styles[type];
    const IconEl = s.icon;
    return (
        <div className="rounded-xl p-4 border flex gap-3" style={{ background: s.bg, borderColor: s.border }}>
            <IconEl size={20} className="shrink-0 mt-0.5" style={{ color: s.color }} />
            <div>
                {title && <p className="font-bold text-sm mb-1" style={{ color: s.color }}>{title}</p>}
                <div className="text-xs leading-relaxed" style={{ color: s.color }}>{children}</div>
            </div>
        </div>
    );
};

// ─── Table Component ───
const Table = ({ headers, rows }) => (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
        <table className="w-full text-sm">
            <thead style={{ background: '#F8FAFC' }}>
                <tr>
                    {headers.map((h, i) => <th key={i} className="text-left px-4 py-2.5 font-bold text-xs uppercase" style={{ color: C.muted }}>{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: C.border }}>
                        {row.map((cell, j) => <td key={j} className="px-4 py-2.5" style={{ color: C.text }}>{cell}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// ─── Code Block ───
const Code = ({ children }) => (
    <code className="px-2 py-0.5 rounded font-mono text-xs" style={{ background: '#F1F5F9', color: '#DC2626', fontWeight: 600 }}>{children}</code>
);

// ─── Sidebar Item ───
const NavItem = ({ href, icon: Icon, label, activeSection, onClick }) => {
    const isActive = activeSection === href;
    return (
        <a
            href={`#${href}`}
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
                background: isActive ? C.brand : 'transparent',
                color: isActive ? '#FFF' : C.text,
            }}
        >
            <Icon size={15} />
            <span>{label}</span>
            {isActive && <ChevronRight size={14} className="ml-auto" />}
        </a>
    );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const Help = () => {
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState('welcome');

    const sections = [
        { id: 'welcome', icon: LayoutDashboard, label: 'Welcome & Overview' },
        { id: 'getting-started', icon: Play, label: 'Getting Started' },
        { id: 'plc-management', icon: Cpu, label: 'PLC Management' },
        { id: 'siemens', icon: Server, label: 'Siemens S7 Setup' },
        { id: 'modbus', icon: Network, label: 'Modbus TCP Setup' },
        { id: 'opcua', icon: KeyRound, label: 'OPC-UA Setup' },
        { id: 'ethernet-ip', icon: Zap, label: 'Allen-Bradley Setup' },
        { id: 'delta', icon: Wrench, label: 'Delta PLC Setup' },
        { id: 'tag-address', icon: ClipboardCheck, label: 'Tag Address Formats' },
        { id: 'connector', icon: FolderArchive, label: 'Factory Connector' },
        { id: 'runtime', icon: BarChart, label: 'HMI & Runtime' },
        { id: 'alarms', icon: Bell, label: 'Alarms' },
        { id: 'users-roles', icon: Users, label: 'Users & Roles' },
        { id: 'troubleshoot', icon: FileWarning, label: 'Troubleshooting' },
        { id: 'faq', icon: HelpCircle, label: 'FAQ' },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: C.bg }}>

            {/* HEADER */}
            <div className="px-6 py-5 flex-shrink-0 bg-white border-b" style={{ borderColor: C.border }}>
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)` }}>
                        <Book size={20} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold" style={{ color: C.heading }}>Help & Documentation</h1>
                        <p className="text-xs" style={{ color: C.subtle }}>Complete guide for connecting PLCs, configuring tags, and using OnlineSCADA</p>
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search topics..."
                            className="pl-9 pr-3 py-2 rounded-xl text-sm border bg-white outline-none focus:border-blue-500 w-64"
                            style={{ borderColor: C.border }}
                        />
                    </div>
                </div>
            </div>

            {/* BODY: Sidebar + Main Content */}
            <div className="flex-1 overflow-hidden flex max-w-7xl mx-auto w-full">

                {/* SIDEBAR NAV */}
                <aside className="w-64 flex-shrink-0 overflow-y-auto p-4 border-r hidden md:block" style={{ borderColor: C.border, background: '#FFFFFF' }}>
                    <p className="text-xs font-bold uppercase mb-3 px-3" style={{ color: C.subtle }}>Documentation</p>
                    <nav className="space-y-1">
                        {sections
                            .filter(s => !search || s.label.toLowerCase().includes(search.toLowerCase()))
                            .map(section => (
                                <NavItem key={section.id} href={section.id} icon={section.icon} label={section.label} activeSection={activeSection} onClick={() => setActiveSection(section.id)} />
                            ))}
                    </nav>
                </aside>

                {/* MAIN CONTENT */}
                <main className="flex-1 overflow-y-auto p-6 space-y-10">

                    {/* ═══════ WELCOME ═══════ */}
                    <Section id="welcome" icon={LayoutDashboard} title="Welcome to OnlineSCADA">
                        <Card>
                            <p>
                                OnlineSCADA is a cloud-based SCADA/HMI platform that lets you monitor and control your factory PLCs from any web browser, anywhere in the world. This documentation covers everything you need to know to connect your machines, configure tag addresses, design HMI screens, and troubleshoot common issues.
                            </p>
                        </Card>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card title="🌐 What is OnlineSCADA?">
                                A cloud-based SCADA system that runs 100% in your web browser. No software installation needed for daily users. Multi-tenant SaaS with role-based access.
                            </Card>
                            <Card title="🏭 What is Factory Connector?">
                                A tiny application that runs on any PC in your factory. It securely reads your PLCs and streams data to the cloud so you can access it from any browser.
                            </Card>
                            <Card title="🔒 Is It Secure?">
                                Yes! All data is encrypted with TLS 1.3. Each company has isolated workspaces. No PLC is ever exposed to the internet. Password-protected users with role-based access.
                            </Card>
                            <Card title="🎯 What Do I Need?">
                                Just a web browser to use the system. To read real PLC data, you also need one Windows PC in the factory that can access both your PLC and the internet.
                            </Card>
                        </div>
                    </Section>

                    {/* ═══════ GETTING STARTED ═══════ */}
                    <Section id="getting-started" icon={Play} title="Getting Started" color={C.success}>
                        <Card title="🚀 5-Minute Quick Start">
                            <ol className="list-decimal ml-5 space-y-2">
                                <li><strong>Sign Up</strong> at <Code>app.onlinescada.in</Code> — creates a free 14-day trial workspace.</li>
                                <li><strong>Add a PLC</strong> from PLC Management page — select protocol (Siemens/Modbus/OPC-UA/Allen-Bradley).</li>
                                <li><strong>Add Tags</strong> with correct addresses for your protocol.</li>
                                <li><strong>Download the Factory Connector</strong> — extract and double-click <Code>Start.bat</Code>.</li>
                                <li><strong>Design HMI Screens</strong> in the Graphic Designer with drag-and-drop.</li>
                                <li><strong>View Live Data</strong> in Runtime from any browser!</li>
                            </ol>
                        </Card>

                        <Alert type="success" title="Try Simulation First (No Hardware Needed)">
                            Click <strong>"Quick Simulation"</strong> on PLC Management to instantly create a demo PLC with 5 fake tags (temperature, pressure, level, motor, counter). Perfect for testing HMI screens without real PLCs.
                        </Alert>
                    </Section>

                    {/* ═══════ PLC MANAGEMENT ═══════ */}
                    <Section id="plc-management" icon={Cpu} title="PLC Management (Equipment Connections)" color={C.brand}>
                        <Card title="Adding a New PLC">
                            <ol className="list-decimal ml-5 space-y-1">
                                <li>Go to <strong>PLC Management</strong> in the sidebar.</li>
                                <li>Click <strong>"Add Equipment"</strong>.</li>
                                <li>Fill in Machine Name, Protocol, IP Address, Port.</li>
                                <li>Click <strong>Save Equipment</strong>.</li>
                            </ol>
                        </Card>

                        <Card title="Understanding Protocols">
                            <Table
                                headers={['Protocol', 'Default Port', 'PLC Brands', 'Best For']}
                                rows={[
                                    ['Siemens S7', '102', 'S7-300/400/1200/1500', 'Siemens PLCs'],
                                    ['Modbus TCP', '502', 'Delta, Schneider, ABB, etc.', 'Most industrial devices'],
                                    ['OPC-UA', '4840', 'Modern Siemens, ABB, Rockwell', 'Newer PLCs, universal'],
                                    ['Ethernet/IP', '44818', 'Allen-Bradley, Rockwell', 'ControlLogix, MicroLogix'],
                                    ['Simulation', '—', 'Virtual', 'Testing without hardware'],
                                ]}
                            />
                        </Card>
                    </Section>

                    {/* ═══════ SIEMENS S7 ═══════ */}
                    <Section id="siemens" icon={Server} title="Siemens S7 PLC Setup" color="#FF6B00">
                        <Card title="Basic Configuration">
                            <Table
                                headers={['Setting', 'Value']}
                                rows={[
                                    ['Protocol', <Code>S7</Code>],
                                    ['Port', <Code>102</Code>],
                                    ['Rack', <Code>0</Code>],
                                    ['Slot (S7-1200/1500)', <Code>0</Code>],
                                    ['Slot (S7-300)', <Code>2</Code>],
                                    ['Slot (S7-400)', <Code>2 or 3</Code>],
                                ]}
                            />
                        </Card>

                        <Alert type="warning" title="⚠️ CRITICAL: Enable PUT/GET in TIA Portal">
                            In TIA Portal, open your CPU properties → <strong>Protection & Security</strong> → <strong>Connection Mechanisms</strong> → check <strong>"Permit access with PUT/GET communication from remote partner"</strong>. Without this, S7-1200/1500 will REFUSE all external connections!
                        </Alert>

                        <Card title="S7 Tag Address Format Examples">
                            <Table
                                headers={['Memory Type', 'Address Format', 'Example', 'Data Type']}
                                rows={[
                                    ['Data Block Bit', 'DBx.DBXy.z', <Code>DB1.DBX0.0</Code>, 'BOOL'],
                                    ['Data Block Byte', 'DBx.DBBy', <Code>DB1.DBB2</Code>, 'BYTE'],
                                    ['Data Block Word', 'DBx.DBWy', <Code>DB1.DBW4</Code>, 'INT / WORD'],
                                    ['Data Block DWord', 'DBx.DBDy', <Code>DB1.DBD8</Code>, 'DINT / DWORD'],
                                    ['Data Block Real', 'DBx.DBDy', <Code>DB1.DBD12</Code>, 'REAL'],
                                    ['Memory Bit', 'Mx.y', <Code>M0.0</Code>, 'BOOL'],
                                    ['Input Bit', 'Ix.y', <Code>I0.0</Code>, 'BOOL'],
                                    ['Output Bit', 'Qx.y', <Code>Q0.0</Code>, 'BOOL'],
                                ]}
                            />
                        </Card>
                    </Section>

                    {/* ═══════ MODBUS ═══════ */}
                    <Section id="modbus" icon={Network} title="Modbus TCP Setup" color={C.brand}>
                        <Card title="Basic Configuration">
                            <Table
                                headers={['Setting', 'Value']}
                                rows={[
                                    ['Protocol', <Code>MODBUS_TCP</Code>],
                                    ['Port', <Code>502</Code>],
                                    ['Unit ID / Slave ID', <Code>1</Code>],
                                ]}
                            />
                        </Card>

                        <Card title="Modbus Function Codes & Address Ranges">
                            <Table
                                headers={['Register Range', 'Function Code', 'Type', 'Access']}
                                rows={[
                                    [<Code>00001 - 09999</Code>, 'FC01 / FC05', 'Coils', 'Read/Write bits'],
                                    [<Code>10001 - 19999</Code>, 'FC02', 'Discrete Inputs', 'Read-only bits'],
                                    [<Code>30001 - 39999</Code>, 'FC04', 'Input Registers', 'Read-only 16-bit'],
                                    [<Code>40001 - 49999</Code>, 'FC03 / FC06 / FC16', 'Holding Registers', 'Read/Write 16-bit'],
                                ]}
                            />
                        </Card>

                        <Alert type="info" title="🟢 Auto-Detection Feature">
                            OnlineSCADA's Modbus reader auto-detects working register offsets. If your tag address doesn't work with one interpretation, it silently tries multiple candidates and caches the working one for instant future reads!
                        </Alert>

                        <Card title="REAL / Float (32-bit) Values">
                            REAL values use 2 consecutive registers. Enter the address of the FIRST register (e.g. <Code>40007</Code>) and set Data Type to <Code>REAL</Code>. OnlineSCADA automatically reads 2 registers and combines them using IEEE 754 Big-Endian format.
                        </Card>
                    </Section>

                    {/* ═══════ OPC-UA ═══════ */}
                    <Section id="opcua" icon={KeyRound} title="OPC-UA Setup" color={C.purple}>
                        <Card title="Basic Configuration">
                            <Table
                                headers={['Setting', 'Value']}
                                rows={[
                                    ['Protocol', <Code>OPC_UA</Code>],
                                    ['Port', <Code>4840</Code>],
                                    ['Username', 'blank for anonymous'],
                                    ['Password', 'blank for anonymous'],
                                ]}
                            />
                        </Card>

                        <Card title="NodeID Format">
                            <p>OPC-UA uses <strong>NodeIDs</strong> instead of memory addresses. Syntax: <Code>ns=&lt;namespace&gt;;&lt;type&gt;=&lt;identifier&gt;</Code></p>
                            <Table
                                headers={['Type', 'Prefix', 'Example']}
                                rows={[
                                    ['String', 's=', <Code>ns=3;s="MyDB"."Temperature"</Code>],
                                    ['Numeric', 'i=', <Code>ns=2;i=1085</Code>],
                                ]}
                            />
                        </Card>

                        <Card title="Siemens S7-1500 OPC-UA Examples">
                            For a TIA Portal Data Block named <Code>STAR_DELTA_DB</Code>:
                            <Table
                                headers={['Variable', 'Data Type', 'OPC-UA NodeID']}
                                rows={[
                                    ['START', 'BOOL', <Code>ns=3;s="STAR_DELTA_DB"."START"</Code>],
                                    ['STOP', 'BOOL', <Code>ns=3;s="STAR_DELTA_DB"."STOP"</Code>],
                                    ['Temperature', 'REAL', <Code>ns=3;s="DB_Sensors"."Temperature"</Code>],
                                    ['Counter', 'DINT', <Code>ns=3;s="DB_Prod"."Counter"</Code>],
                                ]}
                            />
                        </Card>

                        <Alert type="success" title="💡 Finding Exact NodeIDs">
                            Download <strong>UAExpert</strong> (free) from Unified Automation. Connect to your OPC-UA server, browse the address space, click any variable, and copy the exact <strong>NodeId</strong> from the Attributes panel. Paste it directly into OnlineSCADA's Tag PLC Address field.
                        </Alert>
                    </Section>

                    {/* ═══════ ALLEN-BRADLEY ═══════ */}
                    <Section id="ethernet-ip" icon={Zap} title="Allen-Bradley (Ethernet/IP) Setup" color="#DC2626">
                        <Card title="MicroLogix 1400 via Modbus TCP" badge="RECOMMENDED" badgeColor={C.success}>
                            MicroLogix 1400 has built-in Ethernet + Modbus TCP! Enable Modbus TCP in RSLogix 500:
                            <ol className="list-decimal ml-5 space-y-1 mt-2">
                                <li>RSLogix 500 → <strong>Channel Configuration</strong> → Channel 1</li>
                                <li>Enable <strong>Modbus TCP Server</strong>, Port <Code>502</Code></li>
                                <li>Click <strong>Modbus Mapping</strong> to map internal files to Modbus addresses.</li>
                            </ol>
                        </Card>

                        <Card title="MicroLogix Address Conversion">
                            <Table
                                headers={['A-B File', 'Data Type', 'OnlineSCADA Address']}
                                rows={[
                                    ['N7:0 (Integer)', 'INT', <Code>40001</Code>],
                                    ['N7:1', 'INT', <Code>40002</Code>],
                                    ['B3:0/0 (Bit)', 'BOOL', <Code>00001</Code>],
                                    ['B3:0/1', 'BOOL', <Code>00002</Code>],
                                    ['F8:0 (Float)', 'REAL', <Code>40100</Code>],
                                    ['O:0.0/0 (Output)', 'BOOL', <Code>00100</Code>],
                                    ['I:0.0/0 (Input)', 'BOOL', <Code>10001</Code>],
                                ]}
                            />
                        </Card>

                        <Card title="ControlLogix / CompactLogix via Native Ethernet/IP">
                            <Table
                                headers={['Setting', 'Value']}
                                rows={[
                                    ['Protocol', <Code>ETHERNET_IP</Code>],
                                    ['Port', <Code>44818</Code>],
                                    ['Slot', <><Code>0</Code> (usually)</>]
                                ]}
                            />
                            <p className="mt-2">Tag addresses use the CIP tag names from Studio 5000 (e.g. <Code>Temperature</Code>, <Code>Motor1.Speed</Code>).</p>
                        </Card>
                    </Section>

                    {/* ═══════ DELTA PLC ═══════ */}
                    <Section id="delta" icon={Wrench} title="Delta PLC Setup" color="#F97316">
                        <Card title="Delta DVP Series (via RS485-to-Ethernet)">
                            Delta DVP-14SS2 and similar don't have built-in Ethernet. You need one of:
                            <ul className="list-disc ml-5 mt-2 space-y-1">
                                <li><strong>RS485-to-Ethernet Converter</strong> (₹1,800 - Waveshare/HF2211/Moxa) — RECOMMENDED</li>
                                <li><strong>USB-to-RS485 Dongle</strong> on the Gateway PC (₹250)</li>
                                <li>Delta's <strong>DVP-EN01-SL</strong> Ethernet module</li>
                            </ul>
                        </Card>

                        <Card title="Delta Modbus Address Conversion">
                            <Table
                                headers={['Delta Memory', 'Description', 'OnlineSCADA Address']}
                                rows={[
                                    ['D0 (Data Register)', 'Holding Register D0', <Code>44097</Code>],
                                    ['D10', 'Holding Register D10', <Code>44107</Code>],
                                    ['M0 (Internal Flag)', 'Auxiliary Relay M0', <Code>02049</Code>],
                                    ['Y0 (Output)', 'Output Relay Y0', <Code>01281</Code>],
                                    ['X0 (Input)', 'Input Relay X0', <Code>11025</Code>],
                                ]}
                            />
                            <p className="mt-2 text-xs" style={{ color: C.muted }}>
                                💡 You can also type Delta names directly like <Code>D0</Code>, <Code>Y0</Code>, <Code>M0</Code> — our system auto-converts them!
                            </p>
                        </Card>

                        <Alert type="info" title="Test with COMMGR + Modbus Slave">
                            To simulate a Delta PLC on your laptop: Use <strong>Modbus Slave</strong> software on port <Code>502</Code> instead of COMMGR (which uses proprietary Delta protocol on port 10002).
                        </Alert>
                    </Section>

                    {/* ═══════ TAG ADDRESS FORMATS ═══════ */}
                    <Section id="tag-address" icon={ClipboardCheck} title="Tag Address Format Cheat Sheet" color={C.warning}>
                        <Card title="Quick Reference Table">
                            <Table
                                headers={['Protocol', 'Address Format', 'Example', 'Data Type']}
                                rows={[
                                    ['S7', 'DBx.DBXy.z', <Code>DB1.DBX0.0</Code>, 'BOOL'],
                                    ['S7', 'DBx.DBWy', <Code>DB1.DBW4</Code>, 'INT'],
                                    ['S7', 'DBx.DBDy', <Code>DB1.DBD8</Code>, 'DINT / REAL'],
                                    ['Modbus', '5-digit', <Code>40001</Code>, 'INT'],
                                    ['Modbus', 'Coil', <Code>00001</Code>, 'BOOL'],
                                    ['OPC-UA', 'ns=X;s="..."', <Code>ns=3;s="DB1"."T"</Code>, 'ANY'],
                                    ['Ethernet/IP', 'Tag name', <Code>Motor.Speed</Code>, 'INT'],
                                    ['Delta', 'Direct', <Code>D0, Y0, M0</Code>, 'ANY'],
                                ]}
                            />
                        </Card>
                    </Section>

                    {/* ═══════ FACTORY CONNECTOR ═══════ */}
                    <Section id="connector" icon={FolderArchive} title="Factory Connector" color={C.success}>
                        <Card title="What is the Factory Connector?">
                            The Factory Connector is a small app that runs on any Windows PC in your factory. It reads data from your PLCs and streams it securely to the cloud so you can access it from any browser.
                        </Card>

                        <Card title="3-Step Setup">
                            <ol className="list-decimal ml-5 space-y-1">
                                <li>Add your PLCs and tags on the website.</li>
                                <li>Click <strong>"Download Connector"</strong> button on PLC Management page.</li>
                                <li>Extract the ZIP on any factory PC and double-click <strong>Start.bat</strong>.</li>
                            </ol>
                        </Card>

                        <Alert type="warning" title="Node.js Required (One-Time)">
                            The factory PC needs <strong>Node.js LTS</strong> installed. Download from <strong>nodejs.org</strong>. This is a one-time install per PC.
                        </Alert>

                        <Card title="Auto-Start on Windows Boot">
                            After first successful run, the Connector automatically registers itself to run on every Windows startup. To disable, look for the "Disable AutoStart" batch file in the extracted folder.
                        </Card>

                        <Card title="What You'll See in Terminal">
                            <div className="p-3 rounded bg-slate-900 text-green-400 font-mono text-xs whitespace-pre-line">
                                {`========================================================
        OnlineSCADA Factory Connector
========================================================

 [o] Initializing background services...
 [o] Secure cloud tunnel established.
 [o] Connected to equipment: Main_PLC_1

 ========================================================
  [+] SYSTEM ONLINE AND SECURELY STREAMING DATA
 ========================================================`}
                            </div>
                        </Card>
                    </Section>

                    {/* ═══════ RUNTIME ═══════ */}
                    <Section id="runtime" icon={BarChart} title="HMI Runtime" color={C.brand}>
                        <Card title="Viewing Live Data">
                            <ol className="list-decimal ml-5 space-y-1">
                                <li>Click <strong>Runtime</strong> in the sidebar.</li>
                                <li>Select the screen you want to view.</li>
                                <li>Press <strong>F11</strong> for fullscreen mode.</li>
                                <li>Press <strong>Ctrl+Q</strong> to exit fullscreen.</li>
                            </ol>
                        </Card>
                        <Card title="Interacting with Screens">
                            Click buttons, switches, IO fields to send commands to your PLCs. All actions are logged with user info. Viewers cannot write; Operators/Engineers/Admins can.
                        </Card>
                    </Section>

                    {/* ═══════ ALARMS ═══════ */}
                    <Section id="alarms" icon={Bell} title="Alarm Management" color={C.danger}>
                        <Card title="Creating Alarms">
                            <ol className="list-decimal ml-5 space-y-1">
                                <li>Go to <strong>Alarms</strong> page.</li>
                                <li>Click <strong>Add Alarm</strong>.</li>
                                <li>Select the tag to monitor.</li>
                                <li>Set the trigger condition (greater than, less than, equal to, etc).</li>
                                <li>Set severity: Critical / Warning / Info.</li>
                            </ol>
                        </Card>
                    </Section>

                    {/* ═══════ USERS & ROLES ═══════ */}
                    <Section id="users-roles" icon={Users} title="Users & Roles" color={C.purple}>
                        <Card title="Role Permissions">
                            <Table
                                headers={['Role', 'Permissions']}
                                rows={[
                                    ['Admin', 'Everything (users, settings, PLCs, screens, alarms)'],
                                    ['Engineer', 'Configure PLCs, tags, screens, alarms (no user management)'],
                                    ['Operator', 'View runtime, acknowledge alarms, write tag values'],
                                    ['Viewer', 'View only, no writing allowed'],
                                ]}
                            />
                        </Card>
                    </Section>

                    {/* ═══════ TROUBLESHOOTING ═══════ */}
                    <Section id="troubleshoot" icon={FileWarning} title="Common Issues & Solutions" color={C.danger}>
                        <Card title="🔴 PLC shows OFFLINE on website">
                            <ul className="list-disc ml-5 space-y-1">
                                <li>Make sure the Factory Connector is running on the factory PC.</li>
                                <li>Verify the PLC IP is reachable via <Code>ping</Code> command.</li>
                                <li>Check firewall isn't blocking the connection.</li>
                                <li>For Siemens: enable PUT/GET in TIA Portal.</li>
                                <li>For OPC-UA: verify NodeIDs with UAExpert.</li>
                            </ul>
                        </Card>

                        <Card title="🔴 Start.bat opens and closes instantly">
                            <ul className="list-disc ml-5 space-y-1">
                                <li>Extract the ZIP file properly (don't run from inside ZIP preview).</li>
                                <li>Right-click Start.bat → "Run as Administrator".</li>
                                <li>Make sure <Code>config.json</Code> exists in the folder.</li>
                                <li>Avoid folder names with special characters like <Code>(2)</Code>.</li>
                            </ul>
                        </Card>

                        <Card title="🔴 'Node.js is not installed'">
                            Download and install Node.js LTS from <strong>nodejs.org</strong>. It's a one-time install.
                        </Card>

                        <Card title="🔴 Tag values show NULL">
                            <ul className="list-disc ml-5 space-y-1">
                                <li>Verify the tag address matches your PLC memory location.</li>
                                <li>For Modbus: check register offset and function code.</li>
                                <li>For OPC-UA: use UAExpert to copy exact NodeID.</li>
                                <li>Check PLC is in RUN mode.</li>
                            </ul>
                        </Card>

                        <Card title="🔴 Modbus 'Illegal Data Address' (Exception 2)">
                            The register offset is beyond the PLC's defined range. Verify the address exists in the PLC. Our system auto-tries multiple offset interpretations!
                        </Card>

                        <Card title="🔴 'Cannot download Ready Package'">
                            Make sure you're logged in as Admin or Engineer. If page shows "No gateway profile", refresh — the system auto-creates one for each company.
                        </Card>
                    </Section>

                    {/* ═══════ FAQ ═══════ */}
                    <Section id="faq" icon={HelpCircle} title="Frequently Asked Questions" color={C.warning}>
                        <Card title="Do I need to install anything on user PCs?">
                            <strong>No!</strong> Users only need a web browser. Only one factory PC needs the Factory Connector installed.
                        </Card>
                        <Card title="Does the PLC need internet access?">
                            <strong>No!</strong> The PLC stays on your private factory network. Only the Factory Connector PC needs internet.
                        </Card>
                        <Card title="What happens if internet fails at the factory?">
                            The PLC continues running normally. When internet returns, the Connector automatically reconnects and resumes streaming.
                        </Card>
                        <Card title="Can multiple users view the same screen simultaneously?">
                            <strong>Yes!</strong> Unlimited concurrent viewers on the same workspace. All see live data in real-time.
                        </Card>
                        <Card title="Can I write values back to the PLC from the browser?">
                            <strong>Yes!</strong> Click any button, IO field, or interactive element on your HMI to send commands to the PLC.
                        </Card>
                        <Card title="Is my data isolated from other companies?">
                            <strong>Yes!</strong> Every company has its own isolated workspace. Data is scoped by companyId at the database level.
                        </Card>
                        <Card title="What if I want to add a new PLC after the Connector is running?">
                            Simply add the PLC on the website. The Connector automatically hot-reloads its configuration without restart!
                        </Card>
                        <Card title="How do I contact support?">
                            Email: <strong>support@onlinescada.in</strong>
                        </Card>
                    </Section>

                    <div className="text-center py-8 text-xs" style={{ color: C.subtle }}>
                        © OnlineSCADA 2026 · Cloud-based SCADA for Industry 4.0
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Help;