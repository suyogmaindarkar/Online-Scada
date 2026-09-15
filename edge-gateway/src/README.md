# 🏭 OnlineSCADA Edge Gateway

Connects your factory PLCs to the OnlineSCADA cloud platform.

## Quick Start (5 minutes)

### Step 1: Download Config
1. Login to [app.onlinescada.in](https://app.onlinescada.in)
2. Go to **Settings → Edge Gateways**
3. Click **Download Config**
4. Save `config.json` in this folder

### Step 2: Install Node.js
Download from [nodejs.org](https://nodejs.org/) (v18 or higher)

### Step 3: Run
**Windows:** Double-click `start.bat`
**Linux/Mac:** Run `./start.sh`
**Manual:** `npm install && npm start`

### Step 4: Verify
- Gateway console should show "✅ EDGE GATEWAY IS RUNNING"
- OnlineSCADA dashboard should show gateway as 🟢 Online
- Tag values should start updating in real-time

## Supported PLCs

| Protocol | PLC Brands | Port |
|----------|-----------|------|
| S7 | Siemens S7-300/400/1200/1500 | 102 |
| Modbus TCP | Schneider, Delta, Allen-Bradley, etc. | 502 |
| OPC-UA | Siemens, ABB, Rockwell, etc. | 4840 |

## Requirements
- Node.js 18+
- Network access to PLCs (same LAN)
- Internet access (outgoing port 443 only)
- No firewall changes needed!

## Troubleshooting

**"Connection refused" on S7:**
- Enable "Permit access with PUT/GET" in TIA Portal
- S7-1500/1200: Use Rack=0, Slot=0

**"Timeout" on Modbus:**
- Check PLC IP is reachable: `ping 192.168.0.1`
- Verify Modbus TCP is enabled on PLC

**"Cloud connection failed":**
- Check internet access
- Verify API key in config.json is correct