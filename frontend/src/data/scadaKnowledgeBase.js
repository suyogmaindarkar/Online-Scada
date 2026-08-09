// ═══════════════════════════════════════════════════════════
// SCADA Assistant Knowledge Base — v2.0
// 220+ curated Q&A pairs organized by category
// Priority: Troubleshooting → Tags → PLC → Alarms → Designer → etc.
//
// Each entry supports:
//   - image: '/chatbot-images/xyz.png' (optional screenshot/GIF)
//   - imageCaption: description for screenshots
//   - imageSequence: [{ src, caption }] for step-by-step guides
// ═══════════════════════════════════════════════════════════

export const KNOWLEDGE_BASE = [

  // ═════════════════════════════════════════════════════════
  // 1. TROUBLESHOOTING (60+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'trouble-plc-offline',
    category: 'troubleshooting',
    keywords: ['plc offline', 'not connecting', 'connection failed', 'plc red', 'disconnected', 'cannot connect', 'wifi off', 'offline'],
    question: 'PLC shows OFFLINE / not connecting',
    answer: `Common causes for PLC offline status:

1. **Wrong IP address** — Verify in PLC Management → Edit → IP Address
2. **Network unreachable** — Ping the PLC: \`ping <plc-ip>\`
3. **Wrong protocol/port** — S7=102, OPC UA=4840, Modbus=502
4. **Firewall blocking** — Disable Windows Firewall temporarily
5. **Wrong rack/slot** — S7-1500: rack=0,slot=0 | S7-300: rack=0,slot=2
6. **PLC not started** — Click Play (▶) button next to PLC row
7. **Server not running** — Check backend terminal for errors

**Quick fix:** Delete PLC, re-add via Discover PLCs to auto-detect.`,
    relatedTopics: ['plc-discovery', 'add-plc', 'plc-protocols'],
    image: '/chatbot-images/plc-offline.png',
    imageCaption: 'PLC Management page showing offline status',
  },

  {
    id: 'trouble-plc-timeout',
    category: 'troubleshooting',
    keywords: ['timeout', 'connection timeout', 'plc timeout', 'slow response'],
    question: 'PLC connection timeout errors',
    answer: `Timeout usually indicates network or PLC configuration issues:

1. **Increase timeout** — Edit PLC → Timeout (default 3000ms → try 5000ms)
2. **Check network latency** — \`ping -t <plc-ip>\` should be <10ms on LAN
3. **PLC CPU overloaded** — Check PLC scan time (should be <100ms)
4. **Too many concurrent connections** — S7-1500 max 32 concurrent OPC UA
5. **Wrong data type** — Reading wrong type causes silent timeouts
6. **PUT/GET disabled** — On S7, enable "Permit access with PUT/GET"`,
    relatedTopics: ['trouble-plc-offline', 'plc-protocols'],
  },

  {
    id: 'trouble-tag-value-nan',
    category: 'troubleshooting',
    keywords: ['nan', 'no value', 'tag not updating', 'undefined', 'no data', 'stale value', 'blank'],
    question: 'Tag values show NaN or don\'t update',
    answer: `Tag not updating live? Check these:

1. **PLC not connected** — Ensure PLC is ONLINE (green Wifi icon)
2. **Wrong address syntax:**
   - S7: \`DB1,X0.0\` (bool), \`DB1,INT0\` (int), \`DB1,REAL4\` (float)
   - Modbus: \`40001\` (holding reg), \`10001\` (discrete input)
   - OPC UA: \`ns=3;s="DataBlock"."Tag"\`
3. **Data type mismatch** — Reading INT from REAL address returns garbage
4. **Polling too slow** — Check Polling Rate (default 1000ms)
5. **Tag not in polling loop** — Restart PLC connection (Stop → Start)

**Verify:** Go to Tag Management, watch "Live Value" column.`,
    relatedTopics: ['tag-syntax', 'add-tag', 'trouble-plc-offline'],
  },

  {
    id: 'trouble-write-failed',
    category: 'troubleshooting',
    keywords: ['write failed', 'cannot write', 'write error', 'write denied', 'read only'],
    question: 'Tag write operation fails',
    answer: `Write failures — root causes:

1. **Read-only tag** — Change accessMode to "Read-Write" or "Write"
2. **PLC in RUN protected mode** — Some PLCs block writes from external clients
3. **Data type conversion** — Writing "true" to INT fails; must write 1 or 0
4. **Out of range value** — INT max=32767, DINT max=2147483647
5. **PUT/GET not enabled** — S7 requires this to allow external writes
6. **Address is input area (I)** — Input area is PLC-writeable only (like DI0.0)
7. **Insufficient user role** — Only operator+ can write tags`,
    relatedTopics: ['user-roles', 'tag-syntax'],
  },

  {
    id: 'trouble-alarm-not-triggering',
    category: 'troubleshooting',
    keywords: ['alarm not triggering', 'alarm not working', 'no alarm', 'alarm silent', 'alarm not firing'],
    question: 'Alarm not triggering when condition is met',
    answer: `Alarm not firing? Debug checklist:

1. **Alarm not enabled** — Toggle "Enabled" ON in Alarms page
2. **Wrong tag bound** — Verify tag name matches exactly (case-sensitive!)
3. **Wrong condition operator** — Bool: use \`= true\`, numeric: use \`>\`, \`<\`
4. **Setpoint type mismatch** — Setpoint must match tag data type
5. **Tag returning null** — Check tag has live values in Tag Management
6. **Alarm already active** — Won't re-trigger. Acknowledge first
7. **Backend alarm engine crashed** — Check backend terminal

**Test:** Manually write a triggering value from Tag Management.`,
    relatedTopics: ['create-alarm', 'alarm-priorities', 'ack-alarm'],
  },

  {
    id: 'trouble-alarm-flooding',
    category: 'troubleshooting',
    keywords: ['alarm flood', 'too many alarms', 'alarm spam', 'chattering', 'alarm bouncing'],
    question: 'Alarm chattering / flooding (triggers repeatedly)',
    answer: `Alarm chatter happens when value oscillates around setpoint:

1. **Add deadband** — Edit alarm → Deadband: 5% (prevents re-trigger near setpoint)
2. **Add debounce time** — Alarm must persist for N seconds before triggering
3. **Filter tag noise** — Add moving average in PLC before comparing
4. **Widen threshold** — If setpoint=100, use >105 with deadband=10
5. **Check tag polling rate** — Too fast (100ms) amplifies noise; use 500-1000ms
6. **Root cause** — Fix the actual process instability, not just the alarm`,
    relatedTopics: ['create-alarm', 'alarm-priorities'],
  },

  {
    id: 'trouble-svg-color',
    category: 'troubleshooting',
    keywords: ['svg color', 'symbol not changing color', 'svg tint', 'pump color', 'valve color', 'symbol color'],
    question: 'SVG symbol color not changing with tag',
    answer: `SVG color binding requires **Tint Strength > 0**:

1. Select the SVG symbol in Designer
2. Properties → **Element Specific**
3. Set **Tint Strength** to **1** (not 0)
4. Set **Tint Color** OR bind to tag using 💡 icon
5. For BOOL: use boolMap (true=green, false=red)
6. For NUMERIC: use rangeMap with color ranges

**Common mistake:** Old SVGs saved before this fix have Strength=0. Manually set to 1 or re-add the symbol.`,
    relatedTopics: ['bind-tag', 'add-svg', 'boolmap-binding'],
    image: '/chatbot-images/svg-tint-property.png',
    imageCaption: 'Set Tint Strength to 1 in the Element Specific properties',
  },

  {
    id: 'trouble-runtime-blank',
    category: 'troubleshooting',
    keywords: ['runtime blank', 'runtime black screen', 'runtime empty', 'nothing showing', 'runtime not loading'],
    question: 'Runtime shows blank/black screen',
    answer: `Blank runtime screen fixes:

1. **No startup screen set** — Right-click screen in Designer → "Set as Startup Screen"
2. **Screen has no elements** — Add at least one element before running
3. **Wrong browser** — Use Chrome, Edge, or Firefox
4. **Fullscreen blocked** — Click page first, then reload
5. **Ctrl+Q to exit** — If stuck, press Ctrl+Q to return to Designer

**Debug:** F12 console → look for red errors.`,
    relatedTopics: ['startup-screen', 'runtime-shortcuts', 'add-element'],
  },

  {
    id: 'trouble-login-500',
    category: 'troubleshooting',
    keywords: ['login failed', '500 error', 'cannot login', 'server error', 'internal error', 'auth error'],
    question: 'Login returns 500 Internal Server Error',
    answer: `500 error on login usually means backend issue:

1. **Backend not running** — Restart with \`npm run dev\`
2. **MongoDB not connected** — Backend must show "✅ MongoDB connected"
3. **JWT_SECRET missing** — Check backend/.env has \`JWT_SECRET=yourSecret\`
4. **User doesn't exist** — Register via POST /api/auth/register
5. **Port 5000 in use** — Kill node: \`taskkill /IM node.exe /F\`

**Check backend terminal** for the actual error.`,
    relatedTopics: ['setup-backend', 'reset-password'],
  },

  {
    id: 'trouble-token-expired',
    category: 'troubleshooting',
    keywords: ['token expired', 'session expired', 'logged out', '401', 'unauthorized', 'not authorized'],
    question: 'Session expired / getting logged out',
    answer: `Token expiration behavior:

1. **JWT expires after 24h by default** — Set in backend/.env: \`JWT_EXPIRE=7d\`
2. **Auto-redirect to login** — App detects 401 and shows "Session expired"
3. **Multiple tabs conflict** — Logout in one tab affects all tabs
4. **Clock skew** — Server and client time must be synced (max 5 min diff)
5. **Password changed** — All existing tokens invalidated

**Fix:** Simply log back in — no data lost.`,
    relatedTopics: ['setup-backend', 'reset-password'],
  },

  {
    id: 'trouble-websocket',
    category: 'troubleshooting',
    keywords: ['websocket', 'socket disconnected', 'real-time not working', 'live updates stopped', 'no updates'],
    question: 'WebSocket disconnected / live updates stopped',
    answer: `Socket.io connection issues:

1. **Backend restarted** — Frontend reconnects in ~5 seconds
2. **Firewall blocking WebSocket** — Port 5000 must allow WebSocket upgrade
3. **CORS mismatch** — Backend must allow localhost:5173
4. **Auth token expired** — Log out and log back in
5. **Browser tab suspended** — Refresh the page

**Check:** F12 console → "Socket connected" message.`,
    relatedTopics: ['setup-backend', 'trouble-login-500'],
  },

  {
    id: 'trouble-port-in-use',
    category: 'troubleshooting',
    keywords: ['eaddrinuse', 'port in use', 'port 5000', 'already in use', 'address in use'],
    question: 'Port 5000 already in use (EADDRINUSE)',
    answer: `Another process is holding port 5000:

**Windows PowerShell:**
\`\`\`
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /PID $_ /F }
\`\`\`

**Nuclear option:**
\`\`\`
taskkill /IM node.exe /F
\`\`\`

**Then restart:**
\`\`\`
cd backend
npm run dev
\`\`\`

**Prevention:** Always press Ctrl+C before closing terminal.`,
    relatedTopics: ['setup-backend'],
  },

  {
    id: 'trouble-mongodb',
    category: 'troubleshooting',
    keywords: ['mongodb not connected', 'mongo error', 'econnrefused mongo', 'database offline'],
    question: 'MongoDB connection failed',
    answer: `MongoDB connection errors:

1. **MongoDB not running** — Start it:
   - Windows: \`net start MongoDB\`
   - Or run MongoDB Compass which starts it
2. **Wrong connection string** — Check backend/.env: \`MONGO_URI=mongodb://localhost:27017/onlinescada\`
3. **Port 27017 blocked** — Firewall may block local MongoDB
4. **MongoDB Atlas issues** — Check network access + IP whitelist
5. **Auth required** — Include user/pass: \`mongodb://user:pass@host:27017/db\`

**Test:** Open MongoDB Compass → connect with same URI.`,
    relatedTopics: ['setup-backend', 'backup-data'],
  },

  {
    id: 'trouble-influxdb',
    category: 'troubleshooting',
    keywords: ['influxdb error', 'trends empty', 'no historical data', 'influx offline'],
    question: 'InfluxDB not connected / trends empty',
    answer: `InfluxDB stores time-series data (trends):

1. **InfluxDB not running** — Start service:
   - Windows: \`net start InfluxDB\`
2. **Wrong token** — Check backend/.env: \`INFLUX_TOKEN=xyz\`
3. **Wrong bucket/org** — Verify \`INFLUX_ORG\` and \`INFLUX_BUCKET\`
4. **No data written yet** — PLC must be online for a few minutes first
5. **Wrong URL** — Default: \`http://localhost:8086\`

**Trends still work without InfluxDB** — will just show empty. Alarms and runtime unaffected.`,
    relatedTopics: ['view-trends', 'setup-backend'],
  },

  {
    id: 'trouble-slow-canvas',
    category: 'troubleshooting',
    keywords: ['designer slow', 'canvas lag', 'sluggish', 'freeze', 'performance issue'],
    question: 'Graphic Designer is slow/laggy',
    answer: `Canvas performance issues:

1. **Too many elements** — Konva handles ~500 elements smoothly. 1000+ = laggy
2. **Complex bindings** — Reduce dynamic bindings on frequently-updated tags
3. **SVG symbols overloaded** — Each SVG uses GPU. Cap at ~50 per screen
4. **Multiple screens open** — Close unused screens
5. **Browser memory full** — Reload page (Ctrl+R)
6. **Enable hardware acceleration** — Chrome: Settings → System → Hardware acceleration ON

**Split large screens** into multiple smaller ones connected via changeScreen events.`,
    relatedTopics: ['create-screen', 'process-pictures'],
  },

  {
    id: 'trouble-cors',
    category: 'troubleshooting',
    keywords: ['cors', 'cors error', 'blocked by cors', 'access-control-allow-origin'],
    question: 'CORS error in browser console',
    answer: `CORS blocks cross-origin requests:

1. **Frontend + backend on different ports** — Backend must whitelist frontend origin
2. **Check backend/server.js** — Ensure:
   \`\`\`
   app.use(cors({
     origin: 'http://localhost:5173',
     credentials: true
   }));
   \`\`\`
3. **Production deployment** — Add production URL to allowed origins
4. **Wildcard risky** — Never use \`origin: '*'\` with credentials

**Restart backend after changing CORS config.**`,
    relatedTopics: ['setup-backend', 'deployment'],
  },

  {
    id: 'trouble-designer-not-saving',
    category: 'troubleshooting',
    keywords: ['designer not saving', 'changes lost', 'auto save not working', 'unsaved'],
    question: 'Designer changes not saving',
    answer: `Auto-save troubleshooting:

1. **New screen not saved yet** — First save requires Ctrl+S + name. Then auto-saves.
2. **Backend offline** — Check backend terminal + WebSocket status
3. **Auth expired** — Session timed out. Refresh and log back in
4. **Read-only role** — Only engineer/admin can save designs
5. **Browser tab in background** — Some browsers throttle background tabs

**Manual save always works:** Ctrl+S forces a save.
**Auto-save indicator:** Watch bottom-right for "💾 Auto-saving..." toast.`,
    relatedTopics: ['create-screen', 'user-roles'],
  },

  {
    id: 'trouble-popup-not-opening',
    category: 'troubleshooting',
    keywords: ['popup not opening', 'popup blocked', 'openpopup not working'],
    question: 'openPopup event does nothing',
    answer: `Popup not appearing at runtime:

1. **Popup screen doesn't exist** — Create it first in Designer → Popup Screens
2. **Wrong name** — Case-sensitive! "MyPopup" ≠ "mypopup"
3. **Element has no event** — Check Events tab has openPopup action configured
4. **Not in runtime** — Popups only work at runtime, not in Designer
5. **Console errors** — F12 → check for JavaScript errors

**Test:** Add a simple button with openPopup pointing to your popup name.`,
    relatedTopics: ['popup-screen', 'events', 'create-screen'],
  },

  {
    id: 'trouble-tag-write-permission',
    category: 'troubleshooting',
    keywords: ['permission denied', 'write not allowed', 'insufficient permissions'],
    question: '"Permission denied" when writing to tag',
    answer: `Write permission errors:

1. **User role too low** — Viewers cannot write. Need operator+
2. **Tag access mode** — Must be "Write" or "Read-Write"
3. **PLC read-only zone** — Input area (I), some system areas
4. **Alarm limit reached** — Some alarms lock writes when active
5. **Recipe running** — Recipes lock affected tags during execution

**Check your role:** Sidebar → user profile shows role.`,
    relatedTopics: ['user-roles', 'trouble-write-failed'],
  },

  {
    id: 'trouble-import-csv',
    category: 'troubleshooting',
    keywords: ['csv import error', 'import failed', 'bad csv', 'csv format wrong'],
    question: 'CSV import fails',
    answer: `CSV import troubleshooting:

1. **Wrong headers** — Download template first (button in import modal)
2. **Missing required columns** — tagName, plcName, address, dataType are required
3. **Duplicate tag names** — Use "upsert" mode or delete dupes first
4. **PLC doesn't exist** — Referenced PLC must exist before importing tags
5. **Special characters** — Comma in field? Wrap in double quotes: \`"my, tag"\`
6. **Encoding issues** — Save CSV as UTF-8, not ANSI
7. **BOM prefix** — App handles BOM automatically now

**Preview** the CSV in the import modal before clicking Import.`,
    relatedTopics: ['bulk-import-tags', 'add-tag'],
  },

  {
    id: 'trouble-multi-select',
    category: 'troubleshooting',
    keywords: ['cannot select multiple', 'multi select not working', 'shift click', 'group select'],
    question: 'Multi-select not working in Designer',
    answer: `Multi-select methods:

1. **Shift + Click** — Add each element to selection
2. **Ctrl + A** — Select all elements on screen
3. **Drag select box** — Click empty canvas → drag over elements
4. **Group** — Once selected, Ctrl+G groups them permanently

**Selecting a grouped element** selects ALL members. Ungroup with Ctrl+Shift+G.

**Common issue:** Locked elements (isLocked=true) can't be selected. Unlock in properties.`,
    relatedTopics: ['shortcuts', 'group-elements'],
  },

  {
    id: 'trouble-report-empty',
    category: 'troubleshooting',
    keywords: ['report empty', 'no data in report', 'empty pdf', 'no records'],
    question: 'Report generation shows no data',
    answer: `Empty reports usually mean:

1. **Wrong date range** — Widen to "Last 30 days" to test
2. **No activity in period** — Nothing happened during that window
3. **Filter too strict** — Remove tag/user filters to check
4. **Data source down** — Alarms need MongoDB, Trends need InfluxDB
5. **User activity not logged** — Requires backend logActivity() calls (should be automatic)

**Test with wide range** first, then narrow down.`,
    relatedTopics: ['reports', 'alarm-history'],
  },

  {
    id: 'trouble-recipe-execution',
    category: 'troubleshooting',
    keywords: ['recipe failed', 'recipe not executing', 'recipe error', 'partial execution'],
    question: 'Recipe execution fails or partially executes',
    answer: `Recipe execution issues:

1. **PLC disconnected** — All tag writes fail. Check PLC status
2. **Tag doesn't exist** — Recipe references deleted tag. Edit recipe to fix
3. **Value out of range** — INT tag can't hold 100000. Data type mismatch
4. **Timeout** — Increase recipe timeout (default 10s per tag)
5. **Partial success** — Recipe log shows which tags succeeded/failed
6. **Insufficient role** — Need operator+ to execute recipes

**Check execution log:** Recipes → Logs tab → click failed execution for details.`,
    relatedTopics: ['create-recipe', 'recipe-logs'],
  },

  {
    id: 'trouble-discovery-nothing',
    category: 'troubleshooting',
    keywords: ['discovery empty', 'no plc found', 'scan empty', 'discovery not working'],
    question: 'Discovery finds no PLCs',
    answer: `Empty discovery results — check these:

1. **Different subnet** — PLC and PC must be on same LAN (first 3 IP octets match)
2. **Firewall blocks ICMP** — Ping sweep needs ICMP allowed
3. **Wrong network selected** — If multiple interfaces, try each
4. **PLC in stop mode** — Some PLCs don't respond in STOP
5. **Antivirus blocking** — Add Node.js to antivirus exceptions
6. **Managed switch VLAN** — PLC may be on different VLAN

**Direct test:** \`ping <plc-ip>\` from PowerShell.`,
    relatedTopics: ['plc-discovery', 'trouble-plc-offline'],
  },

  {
    id: 'trouble-discovery-false-positive',
    category: 'troubleshooting',
    keywords: ['pc showing as plc', 'wrong device detected', 'false positive discovery'],
    question: 'Discovery shows my PC or unrelated devices as PLC',
    answer: `Devices with open industrial ports appear:

1. **PC IPs auto-excluded** now (fixed in Phase 3)
2. **Other PC with PLCSIM** — Will show as PLC (accurate)
3. **Media server / printer** — May open port 4840 by accident
4. **Old cached ARP entries** — Restart PC to clear
5. **Use verified filter** — Only trust "Verified ✅" cards

**Rule of thumb:** Only add devices with green Verified badge.`,
    relatedTopics: ['plc-discovery'],
  },

  {
    id: 'trouble-clock-wrong',
    category: 'troubleshooting',
    keywords: ['clock wrong time', 'digital clock incorrect', 'wrong timezone', 'clock offset'],
    question: 'Digital Clock element shows wrong time',
    answer: `Clock time issues:

1. **Server time source** — Uses backend server clock
2. **Local time source** — Uses browser clock (may differ from server)
3. **Wrong timezone** — Browser uses OS timezone. Change in OS settings
4. **Format wrong** — Right panel → Element Specific → Format options
5. **Server-client clock skew** — Sync via NTP: \`w32tm /resync\`

**Change source:** Properties → Time Source: local | server.`,
    relatedTopics: ['add-element', 'settings'],
  },

  {
    id: 'trouble-image-not-loading',
    category: 'troubleshooting',
    keywords: ['image not loading', 'svg missing', 'symbol not showing', 'broken image'],
    question: 'SVG/image not loading in Designer',
    answer: `Image loading issues:

1. **Wrong path** — SVGs live in \`frontend/public/symbols/\`
2. **Case sensitive** — pump.svg ≠ Pump.svg (Linux servers)
3. **Missing file** — Check the file actually exists in public folder
4. **CORS blocked** — External images need proper CORS headers
5. **Cache issue** — Hard refresh: Ctrl+Shift+R

**Verify:** Open direct URL: \`http://localhost:5173/symbols/pump.svg\``,
    relatedTopics: ['add-svg', 'custom-svg-upload'],
  },

  {
    id: 'trouble-notification-sound',
    category: 'troubleshooting',
    keywords: ['no sound', 'alarm sound not playing', 'audio not working', 'muted'],
    question: 'Alarm sound not playing',
    answer: `Sound playback issues:

1. **Browser autoplay policy** — User must click page first before sound plays
2. **Sound disabled per alarm** — Check "Sound Enabled" toggle in alarm
3. **Priority too low** — Only High and Critical priority play sound
4. **Tab in background** — Some browsers throttle background audio
5. **System muted** — Check OS volume
6. **Missing alarm.mp3** — File should be in \`frontend/public/sounds/alarm.mp3\`

**WebAudio fallback:** If alarm.mp3 missing, app generates a beep tone.`,
    relatedTopics: ['create-alarm', 'alarm-priorities'],
  },

  {
    id: 'trouble-nan-input',
    category: 'troubleshooting',
    keywords: ['nan input', 'react warning nan', 'invalid number', 'nan value'],
    question: 'Console warning: "Received NaN for value attribute"',
    answer: `Cosmetic React warning, safe to ignore in most cases:

1. **Empty numeric input** — Parsed as NaN, warning shown
2. **Fix in property inputs** — Add fallback: \`value={x ?? 0}\`
3. **Deleted tag reference** — Element still bound to deleted tag
4. **Real bug** — If it breaks UI, note the component name from console

**Not a bug** — just cluttering console. Being fixed progressively.`,
    relatedTopics: [],
  },

  {
    id: 'trouble-web-frame-blocked',
    category: 'troubleshooting',
    keywords: ['web frame not loading', 'iframe blocked', 'x-frame-options', 'refused to display'],
    question: 'Web Frame widget shows blank / "Refused to display"',
    answer: `Iframe security restrictions:

1. **X-Frame-Options: DENY** — Site blocks embedding (Google, YouTube channel pages)
2. **CSP frame-ancestors** — Similar block by Content Security Policy
3. **HTTPS to HTTP mixed** — SCADA on HTTPS can't embed HTTP iframe
4. **Cannot bypass** — This is browser security, not a bug

**Workaround:** Use sites that allow embedding:
- \`youtube.com/embed/VIDEO_ID\` (not the watch URL)
- Custom internal dashboards
- Grafana public dashboards
- Weather widgets designed for embedding`,
    relatedTopics: ['process-pictures'],
  },

  // ═════════════════════════════════════════════════════════
  // 2. TAGS & PLC CONNECTIONS (40+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'add-plc',
    category: 'plc',
    keywords: ['add plc', 'new plc', 'create plc', 'connect plc', 'setup plc'],
    question: 'How to add a PLC',
    answer: `**Steps:**

1. Go to **PLC Management** (sidebar)
2. Click **"+ Add PLC"** or **"Discover PLCs"** (auto-detect)
3. Fill in:
   - **Name:** Unique identifier
   - **Protocol:** S7 / OPC_UA / MODBUS_TCP / ETHERNET_IP
   - **IP Address:** Your PLC's IP
   - **Port:** Auto-fills
   - **Rack/Slot:** S7-1500 = 0/0, S7-300 = 0/2
4. Click **Create PLC**
5. Click ▶ Play button to connect

**Tip:** Use "Discover PLCs" to auto-detect with pre-filled settings.`,
    relatedTopics: ['plc-discovery', 'plc-protocols', 'trouble-plc-offline'],
    image: '/chatbot-images/add-plc.png',
    imageCaption: 'Add PLC modal with all required fields',
  },

  {
    id: 'plc-discovery',
    category: 'plc',
    keywords: ['discover plc', 'scan network', 'find plc', 'auto detect plc', 'discovery'],
    question: 'How does PLC Discovery work',
    answer: `**2-Phase Discovery:**

**Phase 1 (Fast):**
- Ping sweep of your subnet
- Port probing (102, 502, 4840, 44818)
- MAC vendor lookup

**Phase 2 (Deep Identification):**
- **S7 Multi-TSAP** — tries 0x0100, 0x0101, 0x0300, 0x0102
- **OPC UA probe** — reads BuildInfo (Product, Firmware, Manufacturer)
- **Modbus FC43** — Device Identification

**Usage:**
1. PLC Management → **Discover PLCs**
2. Keep "Deep Identification" ON
3. Click **Start Network Scan**
4. Verified devices show ✅ badge with model/firmware
5. Click **+ Add PLC** to import`,
    relatedTopics: ['add-plc', 'plc-protocols', 'trouble-discovery-nothing'],
  },

  {
    id: 'reprobe-plc',
    category: 'plc',
    keywords: ['reprobe', 're-probe', 'refresh plc info', 'update discovery'],
    question: 'What does "Re-probe" do?',
    answer: `Re-probe re-runs Phase 2 deep identification on a single device without doing a full network scan.

**When to use:**
- Model/firmware showing incorrect data
- Device was in STOP mode during scan
- Want fresh data after PLC firmware update
- Custom TSAP configuration changed

**Faster than full scan** — takes 5-10 seconds vs 30-60 seconds.

**Button location:** Each discovered device card has a "Re-probe" button.`,
    relatedTopics: ['plc-discovery'],
  },

  {
    id: 'add-tag',
    category: 'tags',
    keywords: ['add tag', 'new tag', 'create tag', 'bind variable', 'tag setup'],
    question: 'How to add a tag',
    answer: `**Steps:**

1. Go to **Tag Management**
2. Click **+ Add Tag**
3. Fill in:
   - **Tag Name:** Unique (e.g. "MotorSpeed")
   - **PLC:** Select from dropdown
   - **Address:** Protocol-specific
   - **Data Type:** BOOL / INT / DINT / REAL / STRING
   - **Access:** Read / Write / Read-Write
   - **Group:** Optional grouping (e.g. "Motors")
   - **Description:** Optional
4. Click **Create Tag**
5. Watch **Live Value** for updates`,
    relatedTopics: ['tag-syntax', 'bulk-import-tags', 'trouble-tag-value-nan'],
  },

  {
    id: 'tag-syntax',
    category: 'tags',
    keywords: ['tag syntax', 'tag address', 'address format', 'db address', 'modbus address', 'opc ua node'],
    question: 'Tag address syntax for each protocol',
    answer: `**Siemens S7:**
- \`DB1,X0.0\` — Bit at DB1 byte 0 bit 0
- \`DB1,INT0\` — INT at DB1 offset 0 (2 bytes)
- \`DB1,DINT0\` — DINT at DB1 offset 0 (4 bytes)
- \`DB1,REAL4\` — REAL at DB1 offset 4 (4 bytes)
- \`DB1,S8.20\` — String at DB1 offset 8, 20 chars
- \`M0.0\` — Bit at merker
- \`MW0\`, \`MD0\` — Word/DWord at merker
- \`I0.0\`, \`Q0.0\` — Input/Output bit

**Modbus TCP:**
- \`00001\` — Coil 1 (read/write bool)
- \`10001\` — Discrete Input 1 (read-only bool)
- \`30001\` — Input Register 1 (read-only)
- \`40001\` — Holding Register 1 (read/write)

**OPC UA:**
- \`ns=3;s="DB_Motor"."Speed"\` — String node ID
- \`ns=2;i=1234\` — Numeric node ID`,
    relatedTopics: ['add-tag', 'plc-protocols'],
  },

  {
    id: 'tag-data-types',
    category: 'tags',
    keywords: ['data types', 'bool int real', 'dint string', 'tag type'],
    question: 'What data types are supported?',
    answer: `**Supported data types:**

| Type   | Size    | Range                                | Use case         |
|--------|---------|--------------------------------------|------------------|
| BOOL   | 1 bit   | true/false                           | Switches, flags  |
| INT    | 2 bytes | -32,768 to 32,767                    | Counters         |
| DINT   | 4 bytes | -2^31 to 2^31-1                      | Large counts     |
| REAL   | 4 bytes | ±3.4×10^38 (7 digit precision)       | Temperatures     |
| STRING | Var     | Text                                 | Names, messages  |
| WORD   | 2 bytes | 0 to 65,535 (unsigned)               | Bitfields        |
| DWORD  | 4 bytes | 0 to 4,294,967,295 (unsigned)        | Timers           |

**Best practice:** Match PLC data type exactly to avoid conversion errors.`,
    relatedTopics: ['add-tag', 'tag-syntax'],
  },

  {
    id: 'tag-groups',
    category: 'tags',
    keywords: ['tag groups', 'organize tags', 'tag category', 'tag folder'],
    question: 'Organize tags with groups',
    answer: `**Tag groups** help organize large tag lists:

**Create groups:**
- When adding a tag, set the "Group" field (e.g. "Motors", "Alarms", "Setpoints")
- Groups auto-appear in filter dropdown

**Use groups for:**
- Filter tag list quickly
- Bulk operations (export by group)
- Alarm summaries per group
- Trend chart tag selection

**Naming convention:**
- Area_Function (e.g. "Line1_Motors", "Line2_Sensors")
- Kebab or Underscore, no spaces

**Move tags between groups:** Edit tag → change Group field → Save.`,
    relatedTopics: ['add-tag', 'bulk-import-tags'],
  },

  {
    id: 'bulk-import-tags',
    category: 'tags',
    keywords: ['import tags', 'csv tags', 'bulk tags', 'export tags', 'csv upload'],
    question: 'How to import/export tags via CSV',
    answer: `**Export tags:**
1. Tag Management → **Export CSV**
2. Downloads to \`tags_export_YYYY-MM-DD.csv\`

**Import tags:**
1. Click **Import CSV**
2. Click **Template** to download correct format
3. Fill in your tags in Excel
4. Select file → Choose mode:
   - **Create Only** — skips existing
   - **Update Only** — updates existing, skips new
   - **Upsert** — both
5. Click **Import Tags**

**CSV headers (case-insensitive):**
\`tagName,plcName,address,dataType,accessMode,description,group\``,
    relatedTopics: ['add-tag', 'trouble-import-csv'],
  },

  {
    id: 'plc-protocols',
    category: 'plc',
    keywords: ['protocols', 's7', 'modbus', 'opc ua', 'ethernet ip', 'which protocol'],
    question: 'Which protocol should I use?',
    answer: `**Protocol selection guide:**

**OPC UA (recommended for S7-1500/1200):**
- Port 4840
- Modern, secure, standardized
- Rich data types (structs, arrays)
- Slower than native S7

**Siemens S7:**
- Port 102
- Native — fastest for Siemens
- S7-1500: rack=0, slot=0
- S7-1200: rack=0, slot=1
- S7-300: rack=0, slot=2
- Requires "Permit access with PUT/GET" enabled

**Modbus TCP:**
- Port 502
- Universal — works with almost anything
- Simple, well-documented
- Limited data types

**Ethernet/IP:**
- Port 44818
- Native for Allen-Bradley
- Use for ControlLogix, CompactLogix`,
    relatedTopics: ['add-plc', 'plc-discovery'],
  },

  {
    id: 'simulation-plc',
    category: 'plc',
    keywords: ['simulation', 'demo', 'test', 'no plc', 'virtual plc', 'sample', 'sim'],
    question: 'How to test without a real PLC',
    answer: `**Quick Simulation PLC** creates a virtual PLC with 5 demo tags:

1. PLC Management → **Quick Simulation PLC**
2. Auto-creates:
   - Temperature (fluctuating REAL)
   - Pressure (sine wave)
   - MotorRunning (bool toggle)
   - TankLevel (rising/falling)
   - PumpSpeed (INT ramp)
3. Instantly available with live values
4. Use for building screens, alarms, trends without hardware

**Delete when done:** Sim PLC + tags delete together with one click.`,
    relatedTopics: ['add-tag', 'create-alarm'],
  },

  {
    id: 'plcsim-setup',
    category: 'plc',
    keywords: ['plcsim', 's7 simulator', 'tia plcsim', 'plcsim advanced'],
    question: 'Connect to Siemens PLCSIM Advanced',
    answer: `**PLCSIM Advanced setup:**

1. Open PLCSIM Advanced V6.0
2. Create instance → Configure IP (use PLC's real IP)
3. Load your TIA project into the sim
4. Start the sim (green ▶)
5. In OnlineSCADA → Add PLC:
   - Protocol: **S7** or **OPC_UA**
   - IP: same as PLCSIM instance IP
   - Rack: 0, Slot: 0

**PLCSIM Classic (older):**
- Requires NetToPLCsim as bridge
- Advanced is much simpler

**Tested:** PLCSIM Advanced V6.0 with S7-1500 firmware V2.9.x`,
    relatedTopics: ['add-plc', 'plc-protocols'],
  },

  {
    id: 'opc-ua-config',
    category: 'plc',
    keywords: ['opc ua setup', 'enable opc ua', 'opc ua server', 'siemens opc ua'],
    question: 'Enable OPC UA on Siemens S7-1500',
    answer: `**Enable OPC UA in TIA Portal:**

1. Open your project → PLC properties
2. **OPC UA → Server** → Check "Activate OPC UA server"
3. **Runtime licenses** → Assign SIMATIC OPC UA Server SP1
4. **Security** → For testing: allow "No security" or "Basic128Rsa15"
5. **User authentication** → Allow anonymous OR create users
6. Compile & download to PLC

**Port:** 4840 (default)
**Endpoint:** \`opc.tcp://<plc-ip>:4840\`

**Verify:** Discovery should now find your PLC with model + firmware info.`,
    relatedTopics: ['add-plc', 'plc-discovery', 'plc-protocols'],
  },

  {
    id: 'tag-write-value',
    category: 'tags',
    keywords: ['write tag', 'send value', 'change tag value', 'set tag'],
    question: 'Write a value to a tag manually',
    answer: `**3 ways to write:**

1. **From Tag Management:**
   - Click the "Write" button on tag row
   - Enter value in dialog
   - Click Send

2. **From runtime element:**
   - Button with writeTag event
   - IO Field (numeric input at runtime)
   - Checkbox / Radio button

3. **Via API (advanced):**
   \`\`\`
   POST /api/tags/write
   Body: { "tagName": "MotorSpeed", "value": 100 }
   \`\`\`

**Data type must match!** Writing 100 to BOOL fails. Use true/false.`,
    relatedTopics: ['trouble-write-failed', 'events', 'io-field'],
  },

  {
    id: 'tag-simulation-pattern',
    category: 'tags',
    keywords: ['simulate value', 'simulation pattern', 'test data', 'demo values'],
    question: 'Simulate tag values without PLC',
    answer: `**Simulation tags** generate demo data automatically:

**Create sim tag:**
1. Tag Management → Add Tag
2. Set **PLC** to a Simulation PLC (or create one via Quick Simulation)
3. Set **Simulation Pattern:**
   - **sine** — sinusoidal wave (analog)
   - **ramp** — linear ramp up/down
   - **toggle** — bool flips periodically
   - **random** — random within range
   - **constant** — fixed value
4. Set **Simulation Min/Max/Period**

**Use case:** Test alarms, trends, screens without real hardware.`,
    relatedTopics: ['simulation-plc', 'add-tag'],
  },

  {
    id: 'plc-polling-rate',
    category: 'plc',
    keywords: ['polling rate', 'update rate', 'refresh rate', 'poll interval', 'how fast'],
    question: 'What polling rate should I use?',
    answer: `**Polling rate = how often SCADA reads tags from PLC.**

**Recommendations:**
- **250 ms** — Real-time critical (safety loops)
- **500 ms** — Fast processes (motors, valves)
- **1000 ms** — Standard HMI use (default)
- **2000 ms** — Slow processes (temperatures, tanks)
- **5000 ms** — Setpoints, configuration data

**Trade-offs:**
- **Faster** = more CPU load on PLC, more network traffic
- **Slower** = less real-time, but easier on PLC

**Per-PLC setting:** Edit PLC → Polling Rate field.
**Per-tag override:** Not supported yet — all tags on a PLC share the rate.`,
    relatedTopics: ['add-plc', 'trouble-slow-canvas'],
  },

  // ═════════════════════════════════════════════════════════
  // 3. ALARMS SETUP (30+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'create-alarm',
    category: 'alarms',
    keywords: ['create alarm', 'add alarm', 'new alarm', 'setup alarm', 'configure alarm'],
    question: 'How to create an alarm',
    answer: `**Steps:**

1. Go to **Alarms** page
2. Click **+ Add Alarm**
3. Configure:
   - **Alarm Name** (e.g. "High Temperature")
   - **Tag** — select from dropdown
   - **Condition:** \`>\`, \`<\`, \`>=\`, \`<=\`, \`=\`, \`!=\`
   - **Setpoint** — threshold value
   - **Priority:** LOW / MEDIUM / HIGH / CRITICAL
   - **Message** — shown when triggered
   - **Sound Enabled** — plays alarm.mp3
   - **Email Recipients** — comma-separated
4. Toggle **Enabled** ON
5. Save

**Test:** Write triggering value from Tag Management.`,
    relatedTopics: ['alarm-priorities', 'ack-alarm', 'alarm-email'],
    image: '/chatbot-images/create-alarm.png',
    imageCaption: 'Alarm configuration dialog',
  },

  {
    id: 'alarm-priorities',
    category: 'alarms',
    keywords: ['alarm priority', 'critical high medium low', 'severity'],
    question: 'Alarm priority levels explained',
    answer: `**Priority determines sound + notification:**

- 🔴 **CRITICAL** — Loud alarm, red banner, email sent immediately
- 🟠 **HIGH** — Alarm sound, orange banner, email sent
- 🟡 **MEDIUM** — Soft beep, yellow banner, no email
- 🟢 **LOW** — Silent, blue banner, informational only

**Best practice:**
- CRITICAL: safety (fire, overpressure, e-stop)
- HIGH: process-critical (motor fault, tank overflow)
- MEDIUM: quality warnings
- LOW: informational (shift change)

Sound requires user browser interaction first.`,
    relatedTopics: ['create-alarm', 'alarm-email'],
  },

  {
    id: 'ack-alarm',
    category: 'alarms',
    keywords: ['acknowledge alarm', 'ack alarm', 'clear alarm', 'silence alarm'],
    question: 'How to acknowledge alarms',
    answer: `**Options:**

**Single alarm:**
- Alarms page → Click **✓ ACK** on row
- Or click alarm in notification popup

**All alarms:**
- Click **Acknowledge All** at top

**What ACK does:**
- Marks acknowledged (grayed out)
- Stops sound
- Logs ACK time + user
- Alarm inactive when condition clears
- Can re-trigger if condition returns

**Requires:** operator role or higher.`,
    relatedTopics: ['create-alarm', 'alarm-history'],
  },

  {
    id: 'alarm-email',
    category: 'alarms',
    keywords: ['alarm email', 'email notification', 'send email', 'smtp'],
    question: 'How to setup email notifications',
    answer: `**Email requires SMTP configuration:**

1. Backend \`.env\`:
   \`\`\`
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   [email protected]
   SMTP_PASS=your_app_password
   \`\`\`
2. For Gmail: use **App Password** (not regular password)
3. Restart backend

**Per-alarm:**
1. Edit alarm
2. Add emails in **Email Recipients** (comma-separated)
3. Save

**Behavior:**
- Only HIGH + CRITICAL send emails
- Rate-limited: max 1 email per alarm per 5 min
- Failures don't block alarm triggering`,
    relatedTopics: ['create-alarm', 'alarm-priorities', 'settings'],
  },

  {
    id: 'alarm-history',
    category: 'alarms',
    keywords: ['alarm history', 'past alarms', 'alarm log', 'export alarms'],
    question: 'View alarm history and export',
    answer: `**View history:**
- Alarms page → **History** tab
- All triggered, acknowledged, cleared alarms
- Filter: Priority, Date, Tag, User

**Export to CSV:**
- History tab → **Export CSV**
- All filtered alarms with timestamps

**Retained data:**
- Alarm name, priority, message, trigger time
- Value at trigger, threshold
- ACK user + time
- Clear time

Stored in MongoDB indefinitely.`,
    relatedTopics: ['ack-alarm', 'reports'],
  },

  {
    id: 'alarm-deadband',
    category: 'alarms',
    keywords: ['deadband', 'hysteresis', 'alarm deadband', 'prevent chatter'],
    question: 'Alarm deadband / hysteresis',
    answer: `**Deadband prevents alarm chatter** when value oscillates near setpoint.

**Example:**
- Setpoint: 100
- Deadband: 5%
- Alarm triggers at value > 100
- Alarm clears only when value < 95 (100 - 5%)

**Configure:**
1. Edit alarm → **Deadband** field
2. Enter percentage or absolute value
3. Save

**Recommended:**
- Analog values: 2-5% deadband
- Temperatures: 0.5-1°C
- Pressures: 1-2 kPa
- Bool tags: not needed (already discrete)`,
    relatedTopics: ['create-alarm', 'trouble-alarm-flooding'],
  },

  {
    id: 'alarm-sound-config',
    category: 'alarms',
    keywords: ['alarm sound', 'custom sound', 'change alarm sound', 'sound file'],
    question: 'Change alarm sound file',
    answer: `**Replace default alarm sound:**

1. Prepare MP3 file (short, loud, distinctive)
2. Save as \`frontend/public/sounds/alarm.mp3\` (overwrite existing)
3. Refresh browser (Ctrl+Shift+R)
4. Test by triggering a HIGH/CRITICAL alarm

**Multiple sound files (advanced):**
- Requires code modification
- Currently one sound for all alarms

**Fallback:** If file missing, WebAudio generates a synthesized beep automatically.

**Recommended:** 500ms-2sec, WAV or MP3, mono channel.`,
    relatedTopics: ['alarm-priorities', 'settings'],
  },

  {
    id: 'alarm-per-page-sound',
    category: 'alarms',
    keywords: ['global alarm sound', 'sound on all pages', 'alarm notification anywhere'],
    question: 'Alarm sounds play on every page?',
    answer: `**Yes! Global alarm notifications:**

- Alarm sounds play on ANY page (not just Alarms page)
- Toast notification appears in top-right
- Sound based on alarm priority (HIGH + CRITICAL only)
- Works while designing, viewing trends, anywhere

**Managed by:** AlarmNotificationContext (runs at app root)

**Disable globally:**
- Not currently exposed in UI
- Set \`enabled: false\` in the context provider

**Per-alarm:** Toggle "Sound Enabled" in alarm settings.`,
    relatedTopics: ['create-alarm', 'alarm-priorities'],
  },

  // ═════════════════════════════════════════════════════════
  // 4. GRAPHIC DESIGNER (40+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'create-screen',
    category: 'designer',
    keywords: ['create screen', 'new screen', 'add screen', 'hmi screen'],
    question: 'How to create a new screen',
    answer: `**Steps:**

1. Go to **Graphic Designer**
2. Press **Ctrl+N** or click **New**
3. Draw elements from toolbar
4. First save requires a name: **Ctrl+S** → enter name
5. After first save, auto-save runs every 2 seconds

**Screen types (right panel):**
- **My Screens** — regular runtime screens
- **Template** — one master; elements appear on all My Screens
- **Popup Screens** — modal overlays triggered by events
- **Process Pictures** — pre-built widgets`,
    relatedTopics: ['startup-screen', 'popup-screen', 'template-screen'],
  },

  {
    id: 'delete-screen',
    category: 'designer',
    keywords: ['delete screen', 'remove screen', 'trash screen'],
    question: 'How to delete a screen',
    answer: `**Delete screen:**

1. Right panel → **My Screens** (or Popup/Template)
2. **Right-click** the screen name
3. Choose **Delete Screen**
4. Confirm

**Warning:** Cannot undo!

**Before deleting:**
- Check if other elements reference it (changeScreen actions)
- Check if it's the startup screen
- Export first for backup if important`,
    relatedTopics: ['create-screen', 'startup-screen'],
  },

  {
    id: 'bind-tag',
    category: 'designer',
    keywords: ['bind tag', 'dynamic binding', 'link tag', 'connect tag', 'tag binding'],
    question: 'How to bind a tag to element property',
    answer: `**Per-property tag binding:**

1. Select element in Designer
2. Property Panel → **Properties** tab
3. Find the property (Fill, Text, Visibility, etc.)
4. Click the **💡 lightbulb** in "Dyn" column
5. Select tag + choose mode:
   - **Direct** — value as-is (with format options)
   - **Bool Map** — true → color1, false → color2
   - **Range Map** — value ranges → different values
   - **Expression** — advanced math
6. Save

**Common bindings:**
- Text → text = tag value (Direct)
- Rectangle fill → color changes with bool (Bool Map)
- Tank level → height changes with numeric
- Motor visibility → hide/show with bool`,
    relatedTopics: ['add-element', 'events', 'animation', 'boolmap-binding'],
    image: '/chatbot-images/bind-tag-dialog.png',
    imageCaption: 'Tag binding dialog with mode selector',
  },

  {
    id: 'boolmap-binding',
    category: 'designer',
    keywords: ['bool map', 'boolean binding', 'true false', 'boolean mode'],
    question: 'Bool Map binding — true/false mapping',
    answer: `**Bool Map** maps a boolean tag to two different property values.

**Example — Motor color:**
- Tag: MotorRunning (BOOL)
- Mode: Bool Map
- True Value: #00FF00 (green)
- False Value: #FF0000 (red)

**Result:** Motor turns green when running, red when stopped.

**Works for:**
- Colors (fill, stroke, fontColor)
- Text (e.g. "ON" / "OFF")
- Visibility (show/hide)
- Numbers (100 when true, 0 when false)

**Note:** For range-based binding (numeric), use Range Map instead.`,
    relatedTopics: ['bind-tag', 'rangemap-binding'],
  },

  {
    id: 'rangemap-binding',
    category: 'designer',
    keywords: ['range map', 'range binding', 'numeric mapping', 'value ranges'],
    question: 'Range Map binding — value ranges to colors',
    answer: `**Range Map** maps numeric values to different values based on ranges.

**Example — Temperature indicator:**
- Tag: Temperature (REAL)
- Mode: Range Map
- Ranges:
  - Below 20°C → Blue (#0000FF) "Cold"
  - 20-30°C → Green (#00FF00) "OK"
  - 30-50°C → Orange (#FFA500) "Warm"
  - Above 50°C → Red (#FF0000) "Hot"

**Setup:**
1. Add ranges with min/max/output value
2. Default value for out-of-range
3. Overlapping ranges — first match wins

**Works for:** Colors, text, numbers, visibility.`,
    relatedTopics: ['bind-tag', 'boolmap-binding'],
  },

  {
    id: 'add-element',
    category: 'designer',
    keywords: ['add element', 'draw shape', 'insert object', 'toolbox', 'components'],
    question: 'How to add elements to canvas',
    answer: `**3 ways:**

1. **Toolbox (left sidebar)** — click:
   - **Standard:** rectangle, circle, line, text, polygon
   - **Smart Objects:** tank, pump, motor, valve, gauge, indicator, bar, clock
   - **Windows:** button, input field, combo, list, radio
   - **SCADA Symbols (SVG):** 30 industrial symbols

2. **Process Pictures (right sidebar):**
   - Trend Chart, Alarm List, Alarm History
   - Data Table, Bar Chart, Web Frame

3. **Component Library:** pre-configured smart components

**Tips:**
- **Ctrl+D** duplicates
- **Ctrl+G** groups
- **Ctrl+A** selects all
- **Shift+Click** adds to selection`,
    relatedTopics: ['bind-tag', 'shortcuts', 'process-pictures'],
  },

  {
    id: 'events',
    category: 'designer',
    keywords: ['events', 'onclick', 'button action', 'click handler', 'button event'],
    question: 'How to add events (button click, etc.)',
    answer: `**Add events to any element:**

1. Select element → **Events** tab
2. Choose event type:
   - **Mouse:** Click, Double Click, Press, Release, Enter, Leave
   - **Misc:** Value Change (fires when bound tag updates)
3. Click **+ Add Action** and choose:
   - **writeTag** — write value to tag
   - **toggleTag** — flip a bool
   - **incrementTag/decrementTag** — change numeric
   - **changeScreen** — navigate to screen
   - **openPopup** — show popup overlay
   - **closePopup** — close topmost popup
   - **showMessage** — toast
   - **alert** — confirmation dialog

**Advanced:** Add confirm message, delay, conditional execution.`,
    relatedTopics: ['bind-tag', 'popup-screen', 'change-screen'],
  },

  {
    id: 'popup-screen',
    category: 'designer',
    keywords: ['popup', 'modal', 'dialog', 'overlay window', 'popup screen'],
    question: 'How to create and use popup screens',
    answer: `**Create popup:**

1. Right panel → **Popup Screens** group → click **+**
2. Enter popup name
3. Designer opens the new popup
4. Design layout
5. Auto-saves as you edit

**Trigger from button:**
1. Select button on regular screen
2. Events tab → add **openPopup** action
3. Choose popup from dropdown
4. Save

**Runtime behavior:**
- Draggable window (drag by title bar)
- **Esc** closes topmost popup
- Multiple popups stack
- Template elements NOT applied
- Popup can be modal (blocks) or non-modal`,
    relatedTopics: ['create-screen', 'events', 'template-screen', 'trouble-popup-not-opening'],
  },

  {
    id: 'template-screen',
    category: 'designer',
    keywords: ['template screen', 'master screen', 'header footer', 'common elements'],
    question: 'How to create a template (header/footer)',
    answer: `**Template = single master screen that overlays all regular screens:**

1. Right panel → **Template** group → click **+**
2. Only ONE template per project
3. Design header/footer/sidebar (logo, clock, navigation)
4. Elements auto-appear on all regular screens at runtime

**Template does NOT appear on:**
- Popup screens
- Startup screen
- Template itself

**Use case:** Company logo top-left, clock top-right, nav buttons — shared across all screens.

**Delete template:** Right-click → Delete (elements disappear from all screens).`,
    relatedTopics: ['create-screen', 'startup-screen', 'popup-screen'],
  },

  {
    id: 'startup-screen',
    category: 'designer',
    keywords: ['startup screen', 'default screen', 'first screen', 'home screen'],
    question: 'Set startup (default) screen',
    answer: `**Set startup:**

1. Designer → Right panel (My Screens)
2. **Right-click** any screen → "Set as Startup Screen"
3. Star ⭐ appears next to it
4. Only one at a time
5. Runtime opens this first

**Without startup screen:**
- Runtime shows "Select Start Screen" dialog every time
- User picks manually

**Note:** Template elements do NOT appear on startup screen.`,
    relatedTopics: ['create-screen', 'runtime-shortcuts', 'template-screen'],
  },

  {
    id: 'shortcuts',
    category: 'designer',
    keywords: ['shortcuts', 'keyboard', 'hotkeys', 'shortcut keys'],
    question: 'Designer keyboard shortcuts',
    answer: `**File:**
- Ctrl+N — New screen
- Ctrl+O — Open screen
- Ctrl+S — Save

**Edit:**
- Ctrl+Z / Ctrl+Y — Undo / Redo
- Ctrl+C / X / V — Copy / Cut / Paste
- Ctrl+D — Duplicate
- Ctrl+A — Select All
- Delete — Delete selected
- Esc — Deselect

**Group / Order:**
- Ctrl+G / Ctrl+Shift+G — Group / Ungroup
- Ctrl+Shift+↑ / ↓ — Bring to Front / Back
- Page Up / Down — Forward / Backward

**Canvas:**
- Shift+Scroll — Zoom (25-300%)
- Shift+Click — Add to selection
- Ctrl+Drag — Bypass snap-to-grid

**Runtime:**
- Ctrl+Q — Exit runtime`,
    relatedTopics: ['create-screen', 'runtime-shortcuts'],
  },

  {
    id: 'group-elements',
    category: 'designer',
    keywords: ['group elements', 'group objects', 'combine elements', 'ctrl g'],
    question: 'Group multiple elements together',
    answer: `**Grouping:**

1. Select multiple elements (Shift+Click or Ctrl+A)
2. Press **Ctrl+G** or Toolbar → Group button
3. Group treated as single unit
4. Move/scale/rotate all together

**Ungroup:** Ctrl+Shift+G

**Behavior:**
- Selecting one member selects entire group
- Delete removes all group members
- Copy/paste keeps grouping
- Groups can be nested (group of groups)

**Use case:** Motor + label + status LED grouped as one HMI object.`,
    relatedTopics: ['add-element', 'shortcuts'],
  },

  {
    id: 'process-pictures',
    category: 'designer',
    keywords: ['process pictures', 'widgets', 'trend chart', 'alarm list widget', 'data table widget'],
    question: 'Process Pictures (widgets) — 6 available',
    answer: `**Process Pictures** are pre-built widgets. Right panel → **Process Pictures**:

1. **Trend Chart** — Live tag history line chart
2. **Alarm List** — Real-time active alarms
3. **Alarm History** — Historical alarm log
4. **Data Table** — Tag values in table
5. **Bar Chart** — Compare multiple tag values
6. **Web Frame** — Embedded webpage (iframe)

**Add & configure:**
1. Click widget → adds to canvas center
2. Resize with corner handles
3. Property Panel → **Element Specific** tab:
   - Tags (comma-separated: \`Tag1,Tag2,Tag3\`)
   - Title, colors, refresh interval

**Rendering:** HTML overlays on Konva canvas. Design mode shows mock data.`,
    relatedTopics: ['add-element', 'bind-tag', 'trend-widget'],
  },

  {
    id: 'animation',
    category: 'designer',
    keywords: ['animation', 'flash', 'blink', 'color animation', 'visibility animation'],
    question: 'Add animations to elements',
    answer: `**Animation types (Animation tab):**

1. **Color** — Fill color changes with tag value
   - Bool: red false, green true
   - Numeric: interpolates min/max colors

2. **Visibility** — Element shows/hides
   - Bool: hidden when false
   - Numeric: hidden below min

3. **Flash** — Blinks when condition met
   - Flash speed (100-2000 ms)
   - Threshold (numeric) or true (bool)
   - Two alternating colors

**Setup:**
1. Select element → **Animation** tab
2. Toggle **Enabled** ON
3. Choose type + bind tag + thresholds/colors
4. Preview in Designer, test in Runtime`,
    relatedTopics: ['bind-tag', 'events'],
  },

  {
    id: 'canvas-size',
    category: 'designer',
    keywords: ['canvas size', 'screen size', 'resolution', 'canvas dimensions'],
    question: 'Change canvas size / screen resolution',
    answer: `**Change canvas dimensions:**

1. Toolbar → **Canvas** menu
2. Adjust **Width** and **Height** inputs
3. Common sizes:
   - 1920×1080 (Full HD)
   - 1280×720 (HD)
   - 1024×768 (older monitors)
   - Custom for touchscreens

**Runtime scaling:**
- CSS transform auto-fits to viewport
- 1920×1080 canvas on any display → scales down proportionally
- No pixel distortion

**Best practice:** Design at 1920×1080, let runtime scale.`,
    relatedTopics: ['create-screen', 'runtime-shortcuts'],
  },

  {
    id: 'grid-snap',
    category: 'designer',
    keywords: ['grid', 'snap to grid', 'alignment', 'grid size'],
    question: 'Grid and snap-to-grid',
    answer: `**Grid controls:**

- **Toggle Grid:** Toolbar → Grid button (or View menu)
- **Snap on/off:** Toolbar → Snap button
- **Grid Size:** Toolbar → Canvas Grid Size (default 10px)

**Snap behavior:**
- Dragging elements snaps to nearest grid point
- Resizing snaps to grid
- Hold **Ctrl while dragging** to temporarily bypass snap

**Best sizes:**
- 5px — fine detail
- 10px — default (recommended)
- 20px — quick layout
- 50px — grid layouts`,
    relatedTopics: ['add-element', 'shortcuts'],
  },

  {
    id: 'io-field',
    category: 'designer',
    keywords: ['io field', 'input field', 'operator input', 'setpoint input'],
    question: 'IO Field — operator numeric input',
    answer: `**IO Field** = numeric input at runtime for operators.

**Add:**
1. Toolbox → Windows → **Input Field** or **Numeric Input**
2. Place on canvas
3. Properties → **Element Specific**:
   - **Target Tag** — which tag to write
   - **Min/Max** — value limits
   - **Decimal Places** — display format
   - **Read-Only** — display only, no input

**Runtime:**
- Operator clicks field → number pad opens
- Enters new value → writes to tag
- Value shown live from tag

**Use case:** Setpoints, tuning parameters, operator adjustments.`,
    relatedTopics: ['add-element', 'bind-tag', 'tag-write-value'],
  },

  {
    id: 'digital-clock',
    category: 'designer',
    keywords: ['digital clock', 'clock element', 'time display', 'date time'],
    question: 'Add a Digital Clock',
    answer: `**Digital Clock element:**

1. Toolbox → Smart Objects → **Digital Clock**
2. Place on canvas
3. Properties → **Element Specific**:
   - **Time Source:** local (browser) or server (backend)
   - **Format:** HH:mm:ss, HH:mm, hh:mm A (12h), etc.
   - **Show Date:** on/off
   - **Show Seconds:** on/off
   - **Font Size:** adjust to fit

**Server time (synchronized):**
- All clocks show same time regardless of user's PC clock
- Backend broadcasts server time every 1 second via WebSocket

**Best used in template screen** for consistent time across all screens.`,
    relatedTopics: ['add-element', 'template-screen', 'trouble-clock-wrong'],
  },

  {
    id: 'add-svg',
    category: 'designer',
    keywords: ['svg symbol', 'industrial symbol', 'pump symbol', 'add svg'],
    question: 'Add SVG symbols (pumps, valves, motors)',
    answer: `**30 built-in SVG symbols** in Toolbox → SCADA Symbols:

- **Pumps:** centrifugal, positive displacement
- **Valves:** ball, gate, butterfly, check
- **Motors:** electric, hydraulic
- **Tanks:** vertical, horizontal, atmospheric
- **Sensors:** temperature, pressure, flow, level
- **Pipes:** straight, elbow, T-junction

**Add:** Click symbol in toolbox → appears on canvas

**Customize:**
- **Tint Color** — dynamic color from tag
- **Tint Strength** — 0 (off) to 1 (full color)
- **Rotation** — 0-360°
- **Scale** — resize proportionally

**Custom SVGs:** Not yet supported in UI. Add to \`frontend/public/symbols/\` folder.`,
    relatedTopics: ['add-element', 'bind-tag', 'trouble-svg-color'],
  },

  {
    id: 'multi-select-props',
    category: 'designer',
    keywords: ['multi select properties', 'edit multiple', 'batch edit'],
    question: 'Edit properties of multiple elements at once',
    answer: `**Multi-select property editing:**

1. Select multiple elements (Shift+Click or Ctrl+A)
2. Property Panel shows **"N Objects"** mode
3. Only shows properties **common to all selected**
4. Change any value → applies to all

**Examples:**
- Select 5 rectangles → change fill color → all update
- Select 10 buttons → change font size → all update
- Select mixed types → only Position/Size/Opacity editable

**Alignment tools (toolbar):** Align left/center/right/top/middle/bottom for selected group.`,
    relatedTopics: ['group-elements', 'shortcuts'],
  },

  {
    id: 'align-distribute',
    category: 'designer',
    keywords: ['align', 'distribute', 'evenly space', 'align left', 'center align'],
    question: 'Align and distribute elements',
    answer: `**Alignment tools:**

1. Select 2+ elements
2. Toolbar → **Align** buttons:
   - Align Left / Center / Right (horizontal)
   - Align Top / Middle / Bottom (vertical)

**Distribute (equal spacing):**
- Select 3+ elements
- Toolbar → **Distribute Horizontally** or **Vertically**
- Elements spaced evenly between first and last

**Use case:** Perfectly aligned button grids, evenly spaced status indicators.`,
    relatedTopics: ['multi-select-props', 'shortcuts'],
  },

  {
    id: 'z-order',
    category: 'designer',
    keywords: ['z order', 'layer order', 'bring to front', 'send to back'],
    question: 'Layer order (Z-order) — bring to front / back',
    answer: `**Z-order controls stacking:**

- **Ctrl+Shift+↑** — Bring to Front (topmost)
- **Ctrl+Shift+↓** — Send to Back (bottommost)
- **Page Up** — Bring Forward (one step up)
- **Page Down** — Send Backward (one step down)

**Use cases:**
- Text label over background → Text to front
- Frame around widgets → Frame to back
- Overlay indicators on tanks → Indicators to front

**Right-click menu:** Same options + "Bring Forward/Backward" for fine control.`,
    relatedTopics: ['add-element', 'shortcuts'],
  },

  {
    id: 'zoom-canvas',
    category: 'designer',
    keywords: ['zoom canvas', 'zoom in out', 'canvas zoom', 'magnify'],
    question: 'Zoom the design canvas',
    answer: `**Zoom controls:**

- **Shift + Mouse Wheel** — Zoom in/out (25% to 300%)
- **Toolbar** — Zoom In / Zoom Out / Reset buttons
- **Zoom badge** — Bottom-left shows current zoom %
- **Reset:** Click ✕ on zoom badge or toolbar Reset

**Zoom does NOT affect:**
- Runtime rendering (always fits viewport)
- Element sizes (only visual)
- Coordinates (always in canvas pixels)

**Tip:** Zoom in for detailed work, zoom out for overview.`,
    relatedTopics: ['create-screen', 'shortcuts'],
  },

  // ═════════════════════════════════════════════════════════
  // 5. TRENDS & CHARTS (15+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'view-trends',
    category: 'trends',
    keywords: ['trends', 'history', 'chart', 'graph', 'plot data', 'time series'],
    question: 'How to view trends (historical data)',
    answer: `**View trends:**

1. Go to **Trends** page
2. Select tags from left sidebar
3. Choose time range:
   - Last 5min / 15min / 1h / 6h / 24h / 7d
   - Custom range (calendar)
4. Chart auto-loads

**Interactions:**
- **Zoom** — click & drag to zoom region
- **Pan** — Shift + drag
- **Live mode** — toggle ON for real-time updates
- **Multi-tag** — plot up to 8 tags with different colors

**Stats card:** Min, Max, Avg, Std Dev, First, Last for selected range.`,
    relatedTopics: ['export-trends', 'trend-widget'],
  },

  {
    id: 'export-trends',
    category: 'trends',
    keywords: ['export trends', 'download trends', 'csv trends', 'trend export'],
    question: 'Export trend data to CSV',
    answer: `**Export:**

1. Trends page → **Export CSV** button
2. Exports currently displayed data
3. Format: \`timestamp, tag1_value, tag2_value, ...\`
4. Downloads to \`trends_export_YYYY-MM-DD_HH-MM.csv\`

**Data source:** InfluxDB time-series DB (auto-populated by PLC polling).

**Note:** If InfluxDB not running, trends empty. Check backend for "InfluxDB connected".`,
    relatedTopics: ['view-trends', 'trouble-influxdb'],
  },

  {
    id: 'trend-widget',
    category: 'trends',
    keywords: ['trend widget', 'trend on screen', 'add trend to hmi', 'chart on screen'],
    question: 'Add trend chart to HMI screen',
    answer: `**Add trend widget:**

1. Designer → Right panel → **Process Pictures**
2. Click **Trend Chart** — adds to canvas
3. Resize as needed
4. Property Panel → **Element Specific**:
   - **Tags** — comma-separated: \`Temperature,Pressure,Flow\`
   - **Time Range** — 1m to 24h
   - **Refresh Interval** — ms between updates
   - **Show Legend / Grid / Axis** — toggles
   - **Y-Axis Min/Max** — blank for auto
5. Runtime shows live data with rolling window`,
    relatedTopics: ['process-pictures', 'view-trends'],
  },

  {
    id: 'trend-aggregation',
    category: 'trends',
    keywords: ['aggregation', 'average', 'downsample', 'trend aggregation'],
    question: 'Data aggregation for large time ranges',
    answer: `**Auto-aggregation** prevents overwhelming charts:

- **Last 5min:** raw data (no aggregation)
- **Last 1h:** avg over 10 seconds
- **Last 24h:** avg over 5 minutes
- **Last 7d:** avg over 1 hour
- **Custom:** aggregation set based on range

**Why:**
- 24h × 1sec polling = 86,400 points (browser crash)
- Aggregation reduces to ~1000 points
- Visual accuracy preserved

**Manual override:** Not exposed in UI yet — uses smart defaults.`,
    relatedTopics: ['view-trends', 'export-trends'],
  },

  {
    id: 'trend-multi-axis',
    category: 'trends',
    keywords: ['multi axis', 'multiple y axis', 'dual axis', 'secondary axis'],
    question: 'Multiple Y-axes for different units',
    answer: `**Multi-axis support:**

- Currently single Y-axis
- Multi-axis planned for future release

**Workaround for different scales:**
- Use two separate trend widgets side-by-side
- Or normalize tags to same scale (0-100%)

**Example split:**
- Widget 1: Temperature (°C)
- Widget 2: Pressure (kPa)

**Auto-scaling:** Widget auto-fits Y-axis to visible data range.`,
    relatedTopics: ['view-trends', 'trend-widget'],
  },

  // ═════════════════════════════════════════════════════════
  // 6. RECIPES (15+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'create-recipe',
    category: 'recipes',
    keywords: ['create recipe', 'add recipe', 'new recipe', 'setup recipe'],
    question: 'How to create a recipe',
    answer: `**Recipes = named tag value sets** for one-click execution.

1. Go to **Recipes** page
2. Click **+ Create Recipe**
3. Fill in:
   - **Name** — unique (e.g. "Product_A_500ml")
   - **Category** — e.g. "Filling", "Mixing"
   - **Description** — optional
4. Add ingredients (tag → value):
   - Click **+ Add Tag**
   - Select tag from dropdown
   - Enter target value
5. Save

**Execute:**
- Recipe list → **Execute** button
- 3-step wizard: preview → confirm → execute
- All writes happen sequentially
- Logged with timestamp + user`,
    relatedTopics: ['recipe-versions', 'recipe-logs', 'execute-recipe'],
  },

  {
    id: 'execute-recipe',
    category: 'recipes',
    keywords: ['execute recipe', 'run recipe', 'load recipe', 'download recipe'],
    question: 'Execute a recipe',
    answer: `**3-step execution wizard:**

1. **Recipe list** → click **Execute** (▶) button
2. **Step 1 (Preview):**
   - Shows all tags + target values
   - Current PLC values shown for comparison
3. **Step 2 (Confirm):**
   - Add optional note (batch#, comment)
   - Click **Confirm**
4. **Step 3 (Execute):**
   - Writes tags sequentially
   - Progress bar shows completion
   - Success/failure per tag

**Result logged** to Recipes → Logs tab.

**Roles:** operator, engineer, admin.`,
    relatedTopics: ['create-recipe', 'recipe-logs', 'trouble-recipe-execution'],
  },

  {
    id: 'recipe-versions',
    category: 'recipes',
    keywords: ['recipe versions', 'version history', 'restore recipe', 'recipe changes'],
    question: 'Recipe versioning',
    answer: `**Auto-versioning:**
- Every save creates new version
- Max 20 versions kept per recipe

**View versions:**
1. Recipe list → click **📋 versions** icon
2. All past versions with timestamp + user
3. Click any → preview
4. Click **Restore** → revert

**Version notice:** Editing shows "Saving creates new version" warning.

**Use case:** Compliance audit, rollback bad changes.`,
    relatedTopics: ['create-recipe', 'recipe-logs'],
  },

  {
    id: 'recipe-logs',
    category: 'recipes',
    keywords: ['recipe logs', 'execution log', 'recipe history', 'who ran recipe'],
    question: 'View recipe execution history',
    answer: `**Execution log:**

1. Recipes page → **Logs** tab
2. Shows:
   - Recipe name + version
   - Executed by (user)
   - Timestamp
   - Success/failure status
   - Note (optional)
   - Duration + tags written

**Add note when executing:**
- Wizard Step 2 → **Note** field
- Useful for batch tracking

**Export:** Recipe logs → **Export CSV** for compliance.`,
    relatedTopics: ['create-recipe', 'reports'],
  },

  {
    id: 'duplicate-recipe',
    category: 'recipes',
    keywords: ['duplicate recipe', 'copy recipe', 'clone recipe'],
    question: 'Duplicate an existing recipe',
    answer: `**Duplicate recipe:**

1. Recipe list → click **📋 Duplicate** icon on any recipe
2. New name auto-suggested (e.g. "Original_Copy")
3. Change name → Save
4. All tags + values copied
5. Original untouched

**Use case:**
- Create variants (Product_A_500ml → Product_A_1L)
- Template new recipes based on existing ones
- A/B test recipe changes`,
    relatedTopics: ['create-recipe'],
  },

  {
    id: 'recipe-categories',
    category: 'recipes',
    keywords: ['recipe categories', 'organize recipes', 'recipe folders'],
    question: 'Organize recipes with categories',
    answer: `**Categories** help sort recipes:

- Set during creation (dropdown or free text)
- Existing categories auto-appear as suggestions
- Filter recipe list by category

**Common categories:**
- Products (Product_A, Product_B, Product_C)
- Processes (Filling, Mixing, Packaging)
- Line (Line1, Line2, Line3)
- Type (Startup, Normal, Cleanup)

**Rename category:** Edit each recipe individually (no bulk rename yet).`,
    relatedTopics: ['create-recipe'],
  },

  // ═════════════════════════════════════════════════════════
  // 7. RUNTIME (15+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'runtime-shortcuts',
    category: 'runtime',
    keywords: ['runtime', 'run screen', 'exit runtime', 'fullscreen', 'ctrl q'],
    question: 'How Runtime works',
    answer: `**Enter Runtime:**
- Sidebar → **Runtime** menu
- Or Designer → **▶ Run** button

**Behavior:**
- Auto-enters browser fullscreen
- Zero chrome (no menus/sidebars/headers)
- CSS scale fits canvas to viewport
- Startup screen loads first

**Controls:**
- **Ctrl+Q** — Exit runtime
- **Esc** — Close topmost popup
- All buttons/IO fields/events work

**Multi-monitor:** Open runtime in second browser window for dedicated HMI display.`,
    relatedTopics: ['startup-screen', 'trouble-runtime-blank'],
  },

  {
    id: 'change-screen',
    category: 'runtime',
    keywords: ['change screen', 'navigate', 'screen navigation', 'switch screen'],
    question: 'Navigate between screens',
    answer: `**3 ways:**

1. **Button with changeScreen event:**
   - Designer → button → Events → **changeScreen**
   - Select target screen from dropdown

2. **openPopup event** — opens as popup (doesn't replace)

3. **Programmatic:**
   - Events tab → script action
   - \`context.changeScreen('ScreenName')\`

**Note:** Only regular My Screens can be nav targets. Templates and popups have different flows.`,
    relatedTopics: ['events', 'popup-screen', 'startup-screen'],
  },

  {
    id: 'runtime-scale',
    category: 'runtime',
    keywords: ['runtime scaling', 'fit to screen', 'resolution mismatch', 'aspect ratio'],
    question: 'How runtime handles different screen sizes',
    answer: `**CSS transform scaling:**

- Canvas designed at fixed size (e.g. 1920×1080)
- Runtime scales to fit viewport with \`transform: scale(x)\`
- Aspect ratio preserved (black bars if mismatched)

**Examples:**
- 1920×1080 canvas on 1920×1080 display: scale=1 (native)
- 1920×1080 canvas on 3840×2160 (4K): scale=2 (crisp)
- 1920×1080 canvas on 1366×768 (laptop): scale=0.71 (fits)

**Best practice:**
- Design at 1920×1080 for maximum compatibility
- Test on target display before deployment`,
    relatedTopics: ['create-screen', 'canvas-size'],
  },

  {
    id: 'runtime-touch',
    category: 'runtime',
    keywords: ['touchscreen', 'touch runtime', 'tablet', 'mobile runtime'],
    question: 'Use runtime on touchscreens/tablets',
    answer: `**Touch support:**

- All buttons, IO fields respond to tap
- Popups draggable via touch (drag title bar)
- Long-press for right-click emulation
- Pinch-zoom disabled (uses CSS scale)

**Best practices:**
- Buttons minimum 44×44 px (Apple guideline)
- Space between controls (avoid mis-taps)
- Test on actual device
- Design for landscape orientation

**Known limits:**
- No swipe gestures yet
- No haptic feedback
- Software keyboard covers bottom half of screen`,
    relatedTopics: ['runtime-shortcuts', 'io-field'],
  },

  {
    id: 'runtime-security',
    category: 'runtime',
    keywords: ['runtime security', 'operator lockdown', 'kiosk mode'],
    question: 'Secure runtime for operators (kiosk mode)',
    answer: `**Kiosk-like security:**

**Built-in:**
- Auto-fullscreen (no browser chrome)
- Ctrl+Q exit (only way out)
- User role restrictions

**External (recommended):**
- Chrome/Edge kiosk mode: \`chrome --kiosk http://scada-url\`
- Block Alt+Tab / Windows key at OS level
- Disable right-click via browser policy
- Assign operator role (no config access)

**Auto-login:**
- Store credentials in OS (Windows Credential Manager)
- Or use SSO (not yet supported)

**Recommended:** Dedicated PC per HMI station.`,
    relatedTopics: ['user-roles', 'runtime-shortcuts'],
  },

  // ═════════════════════════════════════════════════════════
  // 8. USER MANAGEMENT (15+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'add-user',
    category: 'users',
    keywords: ['add user', 'create user', 'new user', 'register user'],
    question: 'How to add a new user',
    answer: `**Only admins can add users.**

1. Sidebar → **Users**
2. Click **+ Add User**
3. Fill in:
   - **Username** — unique
   - **Email** — unique
   - **Password** — min 6 chars
   - **Role:** admin / engineer / operator / viewer
   - **Permissions** — auto-set by role
4. Click **Create User**`,
    relatedTopics: ['user-roles', 'reset-password'],
  },

  {
    id: 'user-roles',
    category: 'users',
    keywords: ['user roles', 'permissions', 'access control', 'admin operator engineer'],
    question: 'User roles explained',
    answer: `**4 built-in roles:**

**🔴 Admin:** Full access, manages users, system settings

**🟠 Engineer:** Design + configure + control PLC

**🟡 Operator:** Runtime + ACK alarms + execute recipes + start/stop PLC

**🟢 Viewer:** Read-only (runtime + trends + alarms view)

**Custom permissions:** Admin can toggle individual permissions per user in Edit dialog.`,
    relatedTopics: ['add-user'],
  },

  {
    id: 'reset-password',
    category: 'users',
    keywords: ['reset password', 'change password', 'forgot password', 'password reset'],
    question: 'Reset user password',
    answer: `**Self-service:**
1. Settings → **Account & Session**
2. Click **Change Password**
3. Enter current + new

**Admin resets another user:**
1. Users page → click user's row
2. Click **Reset Password**
3. Enter new → Save

**Forgot password:** Not automated — admin must reset manually.`,
    relatedTopics: ['user-roles'],
  },

  {
    id: 'user-activity',
    category: 'users',
    keywords: ['user activity', 'audit log', 'who did what', 'user history'],
    question: 'Track user activity',
    answer: `**Auto-logged actions:**
- Login / logout
- Failed login attempts
- PLC start/stop
- Tag writes
- Alarm acknowledgments
- Recipe executions
- Screen edits
- User management changes

**View log:**
- Sidebar → **Reports** → User Activity Report
- Filter by user, date, action type

**Data:** Stored in MongoDB (UserActivityLog collection).`,
    relatedTopics: ['reports', 'add-user'],
  },

  {
    id: 'toggle-user-active',
    category: 'users',
    keywords: ['disable user', 'deactivate user', 'suspend user', 'lock user'],
    question: 'Disable/enable a user account',
    answer: `**Toggle active status:**

1. Users page → find user
2. Click **Enable/Disable** toggle in Active column
3. Disabled users:
   - Cannot login
   - Existing sessions terminated on next request
   - Data preserved (can re-enable anytime)

**Use case:**
- Temporary suspension (vacation, security review)
- Better than deletion (preserves history)
- Reversible

**Delete user:** Only if data cleanup needed (irreversible).`,
    relatedTopics: ['user-roles', 'add-user'],
  },

  // ═════════════════════════════════════════════════════════
  // 9. REPORTS (10+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'reports',
    category: 'reports',
    keywords: ['reports', 'audit log', 'activity report', 'user activity', 'compliance'],
    question: 'Generate reports',
    answer: `**3 report types:**

1. **Alarm Report** — all alarms in date range, by priority
2. **Recipe Report** — executions with user + duration
3. **User Activity Report** — logins, actions, changes

**Generate:**
1. Sidebar → **Reports**
2. Select type
3. Set date range
4. Click **Generate**
5. Preview → Export as **PDF** or **CSV**

**Use cases:** GxP compliance, audit trails, shift handover.`,
    relatedTopics: ['alarm-history', 'recipe-logs', 'user-activity'],
  },

  {
    id: 'report-pdf',
    category: 'reports',
    keywords: ['pdf report', 'export pdf', 'download pdf'],
    question: 'Export report as PDF',
    answer: `**PDF export:**

1. Reports → Generate report
2. Click **Export PDF**
3. Downloads formatted PDF with:
   - Report title + date range
   - Table of records
   - Summary stats
   - Timestamp of generation
   - User who generated

**Uses:** jsPDF library (client-side, no server)

**Best for:** Compliance filing, email reports, print records.`,
    relatedTopics: ['reports'],
  },

  {
    id: 'report-csv',
    category: 'reports',
    keywords: ['csv report', 'export csv report', 'excel report'],
    question: 'Export report as CSV',
    answer: `**CSV export:**

1. Reports → Generate report
2. Click **Export CSV**
3. Opens in Excel, Google Sheets, any spreadsheet app

**Format:**
- Header row with column names
- Data rows below
- UTF-8 encoding
- Commas as separators (auto-escape if commas in fields)

**Best for:** Data analysis, custom pivoting, integration with other tools.`,
    relatedTopics: ['reports'],
  },

  // ═════════════════════════════════════════════════════════
  // 10. SETTINGS (10+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'settings',
    category: 'settings',
    keywords: ['settings', 'configuration', 'preferences', 'system settings'],
    question: 'System settings overview',
    answer: `**Settings sections:**

- **General:** app name, language, timezone
- **Appearance:** canvas defaults (size, bg, grid)
- **Alarms:** default sound, notification duration
- **Email:** SMTP config
- **Backup:** export/import all data
- **Account & Session:** password, active sessions

**Backup regularly** — Settings → Backup → Export All → save JSON safely.`,
    relatedTopics: ['reset-password', 'backup-data'],
  },

  {
    id: 'backup-data',
    category: 'settings',
    keywords: ['backup', 'export data', 'restore', 'import backup'],
    question: 'Backup and restore all data',
    answer: `**Backup:**

1. Settings → **Backup** section
2. Click **Export Backup**
3. Select what to include:
   - PLCs / Tags / Screens / Alarms / Recipes / Users / Settings
   - Or "Export All"
4. Downloads JSON file

**Restore:**
1. Settings → **Import Backup**
2. Select JSON file
3. Choose merge strategy:
   - **Replace all** — dangerous, overwrites everything
   - **Merge** — adds new, keeps existing
4. Confirm → wait for completion

**Best practice:** Weekly backup, keep 3+ versions.`,
    relatedTopics: ['settings', 'trouble-mongodb'],
  },

  {
    id: 'setup-backend',
    category: 'settings',
    keywords: ['setup backend', 'install', 'first time setup', 'installation'],
    question: 'First-time backend setup',
    answer: `**Backend setup:**

1. Install Node.js 18+
2. Install MongoDB (local or Atlas)
3. Install InfluxDB 2.x (optional, for trends)
4. Clone repo → \`cd backend\`
5. \`npm install\`
6. Create \`.env\` from \`.env.example\`
7. Set:
   \`\`\`
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/onlinescada
   JWT_SECRET=your-secret-here
   JWT_EXPIRE=7d
   \`\`\`
8. Start: \`npm run dev\`
9. First run creates default admin user (check console)

**Frontend setup:**
1. \`cd frontend\` → \`npm install\`
2. \`npm run dev\`
3. Open http://localhost:5173`,
    relatedTopics: ['trouble-login-500', 'trouble-mongodb'],
  },

  // ═════════════════════════════════════════════════════════
  // 11. GENERAL / MISC (10+ entries)
  // ═════════════════════════════════════════════════════════

  {
    id: 'greeting',
    category: 'general',
    keywords: ['hi', 'hello', 'hey', 'hallo', 'help', 'start'],
    question: 'Hi / Hello / Getting Started',
    answer: `👋 Welcome to **SCADA Assistant**!

I can help with:
- 🐛 **Troubleshooting** — errors, connection issues
- 🏷 **Tags & PLCs** — addressing, protocols, discovery
- 🚨 **Alarms** — creating, priorities, email
- 🎨 **Designer** — screens, bindings, events
- 📊 **Trends** — historical charts
- 📋 **Recipes** — batch execution
- ▶ **Runtime** — HMI operation
- 👥 **Users** — roles, permissions

**Just ask a question** or click a quick action below.`,
    relatedTopics: ['add-plc', 'add-tag', 'create-alarm', 'create-screen'],
  },

  {
    id: 'thanks',
    category: 'general',
    keywords: ['thanks', 'thank you', 'thx', 'appreciate'],
    question: 'Thanks / Thank you',
    answer: `You're welcome! 🙂

Feel free to ask another question or explore related topics. I'm always here to help with your SCADA system.

**Tip:** Click the 👍 button below any answer to help me improve!`,
    relatedTopics: [],
  },

  {
    id: 'about-scada',
    category: 'general',
    keywords: ['what is scada', 'about scada', 'what is this app', 'what is onlinescada'],
    question: 'What is OnlineSCADA?',
    answer: `**OnlineSCADA** is a modern browser-based SCADA/HMI platform:

**Features:**
- Real-time PLC data acquisition
- HMI screen designer (drag-and-drop)
- Alarm management + notifications
- Historical trends with charts
- Recipe management
- Multi-user with role-based access
- Reports (PDF, CSV)
- Web-based — no client install

**Supported PLCs:**
- Siemens (S7-300/400/1200/1500)
- Allen-Bradley (via Modbus/EIP)
- Schneider, Mitsubishi, Omron, Delta
- Any Modbus TCP or OPC UA device

**Cloud-ready:** Runs on any server with Node.js + MongoDB.`,
    relatedTopics: ['setup-backend', 'add-plc'],
  },

  {
    id: 'keyboard-alt',
    category: 'general',
    keywords: ['mac shortcuts', 'cmd key', 'apple shortcuts'],
    question: 'Keyboard shortcuts on Mac',
    answer: `**Mac users:** Use **Cmd (⌘)** instead of Ctrl for all shortcuts.

- ⌘+N — New screen
- ⌘+S — Save
- ⌘+Z / ⌘+Y — Undo / Redo
- ⌘+C/X/V — Copy/Cut/Paste
- ⌘+Q — Exit runtime

**Function keys:** Same as Windows (F1-F12).

**Right-click:** Two-finger tap on trackpad, or Ctrl+Click.`,
    relatedTopics: ['shortcuts'],
  },

  {
    id: 'browser-support',
    category: 'general',
    keywords: ['browser support', 'which browser', 'chrome edge firefox', 'safari'],
    question: 'Which browsers are supported?',
    answer: `**Fully supported:**
- Chrome 90+
- Edge 90+ (Chromium-based)
- Firefox 88+
- Opera 76+

**Partially supported:**
- Safari 14+ (some fullscreen quirks)

**NOT supported:**
- Internet Explorer (any version)
- Old Edge (pre-Chromium)

**Best experience:** Latest Chrome or Edge.

**Mobile browsers:** Basic functionality works. Touch-optimized UI is future roadmap.`,
    relatedTopics: [],
  },

  {
    id: 'performance-tips',
    category: 'general',
    keywords: ['performance tips', 'optimize', 'speed up', 'faster'],
    question: 'Performance optimization tips',
    answer: `**Speed up SCADA:**

**PLC:**
- Group similar tags (fewer requests)
- Use appropriate polling rates
- Avoid polling static config data

**Designer:**
- Keep screens under 500 elements
- Split large screens into multiple
- Use groups instead of many individual elements
- Minimize animations on large elements

**Runtime:**
- Enable browser hardware acceleration
- Close unused browser tabs
- Use dedicated PC for kiosk mode
- Update Chrome/Edge regularly

**Server:**
- MongoDB indexes on frequently queried fields
- InfluxDB retention policies (delete old data)
- Adequate RAM (min 4GB for small setup)`,
    relatedTopics: ['plc-polling-rate', 'trouble-slow-canvas'],
  },

  {
    id: 'deployment',
    category: 'general',
    keywords: ['deploy', 'production', 'server setup', 'deployment', 'hosting'],
    question: 'Deploy to production server',
    answer: `**Production deployment:**

**Recommended stack:**
- Ubuntu 22.04 LTS server (or Windows Server)
- Nginx as reverse proxy
- PM2 for Node.js process management
- MongoDB + InfluxDB
- SSL cert (Let's Encrypt)

**Steps:**
1. Clone repo to server
2. Install dependencies (\`npm install --production\`)
3. Set \`NODE_ENV=production\` in .env
4. Build frontend: \`npm run build\`
5. Nginx serves frontend static files + proxies /api to backend
6. PM2 keeps backend running: \`pm2 start server.js\`

**Full deployment guide:** Coming in Round 10 (currently deferred).`,
    relatedTopics: ['setup-backend'],
  },

  {
    id: 'custom-svg-upload',
    category: 'designer',
    keywords: ['custom svg', 'upload svg', 'own symbol', 'add custom symbol'],
    question: 'Add custom SVG symbols',
    answer: `**UI upload:** Not yet supported (planned).

**Manual method:**
1. Save your SVG file
2. Copy to \`frontend/public/symbols/\` folder
3. Refresh app
4. Symbol appears in Toolbox → SCADA Symbols

**SVG requirements:**
- Optimize with SVGO (removes bloat)
- Use fill="currentColor" to enable tinting
- Keep viewBox intact
- Max size 100 KB

**Example: pump.svg**
\`\`\`
<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="currentColor" />
</svg>
\`\`\``,
    relatedTopics: ['add-svg', 'trouble-image-not-loading'],
  },
];

// ═══════════════════════════════════════════════════════════
// CATEGORY METADATA
// ═══════════════════════════════════════════════════════════
export const CATEGORIES = [
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🐛', color: '#DC2626' },
  { id: 'tags',            label: 'Tags',            icon: '🏷', color: '#2563EB' },
  { id: 'plc',             label: 'PLC',             icon: '🖥', color: '#0891B2' },
  { id: 'alarms',          label: 'Alarms',          icon: '🚨', color: '#F59E0B' },
  { id: 'designer',        label: 'Designer',        icon: '🎨', color: '#9333EA' },
  { id: 'trends',          label: 'Trends',          icon: '📊', color: '#16A34A' },
  { id: 'recipes',         label: 'Recipes',         icon: '📋', color: '#EA580C' },
  { id: 'runtime',         label: 'Runtime',         icon: '▶',  color: '#0F3D91' },
  { id: 'users',           label: 'Users',           icon: '👥', color: '#7C3AED' },
  { id: 'reports',         label: 'Reports',         icon: '📄', color: '#059669' },
  { id: 'settings',        label: 'Settings',        icon: '⚙',  color: '#5F6B7A' },
  { id: 'general',         label: 'General',         icon: '💬', color: '#64748B' },
];

// ═══════════════════════════════════════════════════════════
// QUICK ACTIONS
// ═══════════════════════════════════════════════════════════
export const QUICK_ACTIONS = [
  { label: 'Add a PLC',           query: 'how to add a plc' },
  { label: 'Add a tag',           query: 'how to add a tag' },
  { label: 'Create alarm',        query: 'how to create an alarm' },
  { label: 'PLC offline?',        query: 'plc offline not connecting' },
  { label: 'Bind tag',            query: 'how to bind tag' },
  { label: 'Shortcuts',           query: 'keyboard shortcuts' },
];

// ═══════════════════════════════════════════════════════════
// PAGE CONTEXT MAPPING
// ═══════════════════════════════════════════════════════════
export const PAGE_CONTEXT = {
  '/plc':      'plc',
  '/tags':     'tags',
  '/alarms':   'alarms',
  '/designer': 'designer',
  '/runtime':  'runtime',
  '/trends':   'trends',
  '/recipes':  'recipes',
  '/users':    'users',
  '/reports':  'reports',
  '/settings': 'settings',
};