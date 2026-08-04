<div align="center">

# ⚡ OnlineSCADA

### **Modern Web-Based SCADA/HMI Platform**

*Supervise · Control · Optimize — All in Real-Time*

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-47A248.svg)](https://mongodb.com)
[![Status](https://img.shields.io/badge/status-Active%20Development-yellow.svg)]()

[Features](#-features) · [Demo](#-quick-demo) · [Installation](#-installation) · [Documentation](#-documentation) · [Roadmap](#-roadmap)

---

**A cloud-based SCADA/HMI system accessible from any browser — no installations, no license fees, no vendor lock-in.**

Design industrial HMI screens with drag-and-drop, connect to real PLCs (Siemens S7, Modbus TCP, OPC-UA), monitor live data with real-time charts, configure priority-based alarms with email notifications, execute parameter recipes, and analyze historical trends — all from a modern web interface.

</div>

---

## 📸 Screenshots

> _Screenshots go here — add images to `docs/screenshots/` and reference them._

| Dashboard | Graphic Designer | Runtime |
|-----------|------------------|---------|
| _(coming soon)_ | _(coming soon)_ | _(coming soon)_ |

---

## ✨ Features

### 🎨 **Graphic HMI Designer**
- **WinCC-inspired UI** — familiar for automation engineers
- **Drag-and-drop canvas** built on Konva.js
- **30+ professional SVG symbols** — motors, valves, pumps, tanks, sensors, indicators, piping
- **Per-property dynamic bindings** — bind any property (color, size, text, visibility) to any PLC tag
- **Multi-mode bindings** — Direct, Boolean Map, Range Map, Expression
- **Multi-action events** — chain actions with delays, conditions, confirmations
- **Component Library** — searchable, categorized symbols with tinting support
- **Undo/Redo, Copy/Paste, snap-to-grid, rotation** — all keyboard shortcuts included

### 🖥️ **Runtime Environment**
- **Real-time value updates** via WebSocket (Socket.IO)
- **Interactive elements** — buttons, IO fields, comboboxes, checkboxes, radio buttons
- **Konva Filters** for live SVG tinting based on tag values
- **Direct Connections** — sync tag values between multiple tags automatically
- **Dark control-room aesthetic** by default

### 🔌 **PLC Communication**
- **Siemens S7** (S7-1200/1500 via `nodes7`)
- **Modbus TCP/RTU** (`modbus-serial`)
- **OPC-UA** (`node-opcua`)
- **Auto-reconnect** with exponential backoff
- **Health monitoring** — detects dead connections and recovers
- **⚡ Simulation Mode** — one-click virtual PLC with 5 realistic demo tags (sine, walk, ramp, toggle, counter patterns) — perfect for demos & testing without hardware

### 🏷️ **Tag Management**
- 8 data types: BOOL, INT, DINT, REAL, STRING, WORD, DWORD, BYTE
- Groups, scaling, alarm/logging flags
- Live value monitoring with quality indicators
- **CSV bulk import/export** with validation & preview
- Manual value writes with type coercion

### 🚨 **Alarms & Notifications**
- **4 priority levels:** LOW, MEDIUM, HIGH, CRITICAL (with distinct sounds)
- **Global notification system** — sounds play from ANY page (Dashboard, Trends, Designer, Runtime)
- **Real audio + WebAudio fallback** — works even without an mp3 file
- **Priority-based beep patterns** — Critical = 4 urgent beeps, others = single beep
- **Email notifications** with SMTP support + throttling
- **Browser notifications** — works even when tab is in background
- **8 alarm types:** HIGH, HIGH_HIGH, LOW, LOW_LOW, EQUAL, NOT_EQUAL, DEVIATION, DIGITAL
- **Deadband** for hysteresis-based clearing
- **Priority filter chips**, color-coded rows, CSV export
- Acknowledge single or bulk

### 📊 **Trends & Analytics**
- **Multi-tag overlay** on same chart (up to 8 tags)
- **Live scrolling mode** with 2-second refresh + sliding window
- **Chart zoom & pan** via Recharts Brush
- **Statistics:** min, max, mean, std deviation, count, range
- **Custom date range** or 8 preset ranges (15m to 30d)
- **CSV export** (client + server-side)
- **InfluxDB integration** for time-series storage (graceful fallback if offline)

### 📈 **Real-time Dashboard**
- **PLC status widgets** with live connection state
- **Recent alarms feed** — last 10 with priority colors
- **Live sparkline charts** for top 4 numeric tags (rolling 30-point window)
- **Click-through navigation** on all cards
- **Auto-refresh every 10 seconds**

### 📋 **Recipe Management**
- Save sets of tag values as **Recipes**
- **Auto-versioning** — every parameter change bumps version (v1.0 → v1.1 → v2.0)
- **Version history** (up to 20 previous versions) with restore capability
- **3-step execution wizard**: Review → Confirm → Execute → Done
- **Execution log** with filters (recipe, status, user, date)
- **Duplicate as template** for quick starting points

### 👥 **User Management**
- 4 roles: `admin`, `engineer`, `operator`, `viewer`
- JWT-based authentication with session expiry handling
- Password reset, activate/deactivate users
- Role-based access control on all API endpoints

### ⚙️ **System Settings**
- Canvas defaults (auto-apply to Designer)
- Notification preferences (sound, browser, timeout, volume)
- Alarm thresholds and grouping
- SMTP configuration
- Backup & restore (JSON export/import)
- Session timeout, password policy, rate limiting

---

## 🚀 Quick Demo

### One-Click Simulation PLC

Perfect for demos without any hardware:

1. Log in → navigate to **PLC Management**
2. Click **"⚡ Quick Simulation PLC"** (purple button)
3. In ~1 second: a new PLC + 5 realistic tags are created and streaming live data
4. Head to **Graphic Designer** — bind these tags to gauges, tanks, motors
5. Click **Runtime** — watch values update in real time
6. Delete the sim PLC when done → tags auto-cleanup

The 5 auto-generated tags:

| Tag Name | Type | Pattern | Range |
|----------|------|---------|-------|
| `SIM_TEMPERATURE` | REAL | Sine wave (30s period) | 20 – 80 °C |
| `SIM_PRESSURE` | REAL | Random walk | 0 – 10 bar |
| `SIM_LEVEL` | INT | Fill/drain ramp | 0 – 100 % |
| `SIM_MOTOR_RUN` | BOOL | Toggles every 15s | true / false |
| `SIM_COUNTER` | DINT | Increments every 2s | 0 – 9999 (wraps) |

---

## 🏗️ Tech Stack

### Frontend
- **[React 18](https://react.dev)** + **[Vite](https://vitejs.dev)** — Fast dev server & builds
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Konva.js](https://konvajs.org)** + **[react-konva](https://github.com/konvajs/react-konva)** — 2D canvas for HMI designer
- **[Recharts](https://recharts.org)** — Interactive trend charts
- **[Socket.IO Client](https://socket.io/docs/v4/client-api/)** — Real-time updates
- **[Axios](https://axios-http.com)** — HTTP client with interceptors
- **[Lucide React](https://lucide.dev)** — Icon library
- **[React Router](https://reactrouter.com)** — SPA routing

### Backend
- **[Node.js 18+](https://nodejs.org)** + **[Express](https://expressjs.com)** — REST API
- **[Socket.IO](https://socket.io)** — WebSocket server
- **[MongoDB](https://mongodb.com)** + **[Mongoose](https://mongoosejs.com)** — Primary database (users, tags, alarms, recipes, screens)
- **[InfluxDB 2](https://influxdata.com)** — Time-series database for trend history
- **[JWT](https://jwt.io)** (`jsonwebtoken`) — Authentication
- **[bcrypt](https://github.com/kelektiv/node.bcrypt.js)** — Password hashing
- **[Nodemailer](https://nodemailer.com)** — SMTP email notifications
- **[express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)** — API rate limiting

### PLC Communication Libraries
- **[nodes7](https://github.com/plcpeople/nodes7)** — Siemens S7 protocol
- **[modbus-serial](https://github.com/yaacov/node-modbus-serial)** — Modbus TCP/RTU
- **[node-opcua](https://github.com/node-opcua/node-opcua)** — OPC-UA client

---

## 📁 Project Structure