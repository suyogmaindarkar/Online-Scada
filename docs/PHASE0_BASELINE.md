# Phase 0 — Release Baseline and Readiness Freeze

Freeze date: (current session date)

## Baseline commit

- Git HEAD: `124a09524f3d9b0f9437bbf2ac11520c6ee57ebc`
- Message: `docs: add launch workflow`
- Working tree: clean (verified via `git status`)

## Deployment versions

| Component | Version | Where deployed | Notes |
|---|---|---|---|
| Landing site | Next.js 15 (Pankaj) | https://onlinescada.in (Vercel) | Separate repo |
| SCADA app frontend | React 19 + Vite, package `frontend` 0.0.0 | https://app.onlinescada.in (Vercel) | Auto-deploy via GitHub |
| Backend API | Node/Express, package `backend` 1.0.0 | https://onlinescada-api.onrender.com | Auto-deploy via GitHub |
| Database | MongoDB Atlas M0 (Mumbai) | At `MONGO_URI` set | 512MB free tier |
| Timeseries (optional) | InfluxDB 2.x local | At INFLUX_URL etc. set (local) | Only local dev, not prod |
| Factory Connector | `onlinescada-edge-gateway` 1.0.0 | Distributed as ZIP/SBSP | edge-gateway/ + backend template copies |

Env var presence confirmed for backend `.env` (PORT, NODE_ENV, MONGO_URI, JWT_SECRET, JWT_EXPIRE, INFLUX_*, FRONTEND_URL, LEADS_EMAIL) and frontend `.env.production` (VITE_GOOGLE_CLIENT_ID). Values never printed/logged.

## Freeze rules

- Do not add unrelated features until the next checkpoint.
- Everything committed for this baseline.

## Short supported-protocol matrix (Phase 0 snapshot)

| Protocol | PLC / device families | Address form | Read | Write | Hardware-verified |
|---|---|---|---|---|---|
| S7 | Siemens S7-300/400/1200/1500 | `DB1.DBD2`, `DB1.DBX0.0`, `M0.0`, `I0.0`, `Q0.0` | yes | yes | S7-1500 (3 models) + PLCSIM |
| OPC UA | Siemens S7-1500, Kepware, Ignition | `ns=3;s="DB"."Tag"`, `ns=2;i=1085` | yes | yes | S7-1500 end-to-end |
| Modbus TCP | ModSim32, Modbus Slave, Delta DVP via RS485-Ethernet | `42001`, `40001`, `00001`, `D0`, `M0` | yes | yes | ModSim32 + Delta SE sim |
| Modbus RTU | any legacy serial device behind gateway | `40001`, `D0` (Delta) | yes | yes | via gateway transport |
| Ethernet/IP | Allen-Bradley ControlLogix/CompactLogix, MicroLogix | `Motor.Speed`, `N7:0`, `B3:0/0` | yes | yes | MicroLogix 1400 via Modbus map |
| PROFIBUS_GATEWAY | any Profibus device via configured gateway | follows transport | yes | yes | depends on gateway |
| SIMULATION | Virtual PLC (5 patterns) | `SIM_*` | yes | yes | built-in |

Note: full hardware qualification tracking belongs to Phase 2 of the launch workflow.
