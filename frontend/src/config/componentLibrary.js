// ═══════════════════════════════════════════════════════════
// Component Library — Sprint F (Batches 1 + 2)
// 20 SVG symbols: 5 motors + 5 valves + 5 pumps + 5 tanks
// ═══════════════════════════════════════════════════════════

export const LIBRARY_CATEGORIES = [
  { id: 'motors', label: 'Motors & Drives', icon: '⚙️', color: '#8b5cf6' },
  { id: 'valves', label: 'Valves', icon: '🔧', color: '#f59e0b' },
  { id: 'pumps', label: 'Pumps', icon: '💧', color: '#06b6d4' },
  { id: 'tanks', label: 'Tanks & Vessels', icon: '🏗️', color: '#10b981' },
  { id: 'sensors', label: 'Sensors & Meters', icon: '📡', color: '#3b82f6' },
  { id: 'piping', label: 'Piping & Flow', icon: '🔩', color: '#64748b' },
  { id: 'indicators', label: 'Indicators & Lights', icon: '💡', color: '#ef4444' },
  { id: 'displays', label: 'Displays & Labels', icon: '🖥️', color: '#0ea5e9' },
  { id: 'controls', label: 'Control Elements', icon: '🎛️', color: '#d946ef' },
  { id: 'hvac', label: 'HVAC', icon: '❄️', color: '#14b8a6' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', color: '#eab308' },
  { id: 'safety', label: 'Safety & Alarms', icon: '🚨', color: '#dc2626' },
];

const svgTemplate = (svgPath, width = 100, height = 100, extras = {}) => ({
  type: 'svgSymbol',
  svgPath,
  width,
  height,
  rotation: 0,
  opacity: 1,
  symbolTint: null,
  symbolTintStrength: 0,
  symbolBrightness: 1,
  preserveAspect: true,
  ...extras,
});

export const LIBRARY_COMPONENTS = [
  // ═══════════════════════════════════════════════════════
  // MOTORS (5) — Batch 1
  // ═══════════════════════════════════════════════════════
  {
    id: 'motor_b3',
    category: 'motors',
    subcategory: 'IEC Standard Motors',
    name: 'Motor B3 (Foot-mounted)',
    description: 'IEC B3 foot-mounted electric motor',
    keywords: ['motor', 'b3', 'foot', 'mounted', 'iec', 'electric'],
    icon: '⚙️',
    thumbnail: '/symbols/motors/motor-b3.svg',
    template: svgTemplate('/symbols/motors/motor-b3.svg', 100, 100),
  },
  {
    id: 'motor_b5',
    category: 'motors',
    subcategory: 'IEC Standard Motors',
    name: 'Motor B5 (Flange-mounted)',
    description: 'IEC B5 flange-mounted electric motor',
    keywords: ['motor', 'b5', 'flange', 'mounted', 'iec'],
    icon: '⚙️',
    thumbnail: '/symbols/motors/motor-b5.svg',
    template: svgTemplate('/symbols/motors/motor-b5.svg', 100, 100),
  },
  {
    id: 'motor_vertical',
    category: 'motors',
    subcategory: 'Vertical Motors',
    name: 'Vertical Motor',
    description: 'Vertically mounted motor',
    keywords: ['motor', 'vertical', 'v-motor'],
    icon: '⚙️',
    thumbnail: '/symbols/motors/motor-vertical.svg',
    template: svgTemplate('/symbols/motors/motor-vertical.svg', 80, 100),
  },
  {
    id: 'motor_simple',
    category: 'motors',
    subcategory: 'Standard Symbols',
    name: 'Motor Symbol (M)',
    description: 'ISA standard motor symbol',
    keywords: ['motor', 'symbol', 'isa', 'standard', 'simple'],
    icon: 'Ⓜ️',
    thumbnail: '/symbols/motors/motor-simple.svg',
    template: svgTemplate('/symbols/motors/motor-simple.svg', 80, 80),
  },
  {
    id: 'motor_servo',
    category: 'motors',
    subcategory: 'Servo Motors',
    name: 'Servo Motor',
    description: 'Servo motor with encoder',
    keywords: ['motor', 'servo', 'encoder', 'precision'],
    icon: '🎯',
    thumbnail: '/symbols/motors/motor-servo.svg',
    template: svgTemplate('/symbols/motors/motor-servo.svg', 100, 100),
  },

  // ═══════════════════════════════════════════════════════
  // VALVES (5) — Batch 1
  // ═══════════════════════════════════════════════════════
  {
    id: 'valve_gate',
    category: 'valves',
    subcategory: 'Gate Valves',
    name: 'Gate Valve',
    description: 'Manual gate valve with handwheel',
    keywords: ['valve', 'gate', 'manual', 'handwheel', 'isa'],
    icon: '🔧',
    thumbnail: '/symbols/valves/valve-gate.svg',
    template: svgTemplate('/symbols/valves/valve-gate.svg', 90, 90),
  },
  {
    id: 'valve_ball',
    category: 'valves',
    subcategory: 'Ball Valves',
    name: 'Ball Valve',
    description: 'Manual ball valve with lever',
    keywords: ['valve', 'ball', 'lever', 'quarter-turn'],
    icon: '🔧',
    thumbnail: '/symbols/valves/valve-ball.svg',
    template: svgTemplate('/symbols/valves/valve-ball.svg', 100, 100),
  },
  {
    id: 'valve_butterfly',
    category: 'valves',
    subcategory: 'Butterfly Valves',
    name: 'Butterfly Valve',
    description: 'Butterfly valve with actuator',
    keywords: ['valve', 'butterfly', 'actuator', 'flow'],
    icon: '🦋',
    thumbnail: '/symbols/valves/valve-butterfly.svg',
    template: svgTemplate('/symbols/valves/valve-butterfly.svg', 100, 100),
  },
  {
    id: 'valve_check',
    category: 'valves',
    subcategory: 'Check Valves',
    name: 'Check Valve',
    description: 'Non-return check valve',
    keywords: ['valve', 'check', 'nrv', 'non-return', 'one-way'],
    icon: '➡️',
    thumbnail: '/symbols/valves/valve-check.svg',
    template: svgTemplate('/symbols/valves/valve-check.svg', 100, 90),
  },
  {
    id: 'valve_solenoid',
    category: 'valves',
    subcategory: 'Solenoid Valves',
    name: 'Solenoid Valve',
    description: 'Electric solenoid actuated valve',
    keywords: ['valve', 'solenoid', 'electric', 'actuator'],
    icon: '⚡',
    thumbnail: '/symbols/valves/valve-solenoid.svg',
    template: svgTemplate('/symbols/valves/valve-solenoid.svg', 90, 100),
  },

  // ═══════════════════════════════════════════════════════
  // PUMPS (5) — Batch 2 ⭐ NEW
  // ═══════════════════════════════════════════════════════
  {
    id: 'pump_centrifugal',
    category: 'pumps',
    subcategory: 'Centrifugal Pumps',
    name: 'Centrifugal Pump',
    description: 'Standard centrifugal pump with impeller',
    keywords: ['pump', 'centrifugal', 'water', 'impeller', 'volute'],
    icon: '💧',
    thumbnail: '/symbols/pumps/pump-centrifugal.svg',
    template: svgTemplate('/symbols/pumps/pump-centrifugal.svg', 100, 100),
  },
  {
    id: 'pump_positive_displacement',
    category: 'pumps',
    subcategory: 'Positive Displacement',
    name: 'PD Pump (Gear)',
    description: 'Positive displacement gear pump',
    keywords: ['pump', 'positive', 'displacement', 'gear', 'pd'],
    icon: '⬆️',
    thumbnail: '/symbols/pumps/pump-positive-displacement.svg',
    template: svgTemplate('/symbols/pumps/pump-positive-displacement.svg', 100, 100),
  },
  {
    id: 'pump_submersible',
    category: 'pumps',
    subcategory: 'Submersible Pumps',
    name: 'Submersible Pump',
    description: 'Submersible water pump with cable',
    keywords: ['pump', 'submersible', 'underwater', 'well', 'borehole'],
    icon: '🌊',
    thumbnail: '/symbols/pumps/pump-submersible.svg',
    template: svgTemplate('/symbols/pumps/pump-submersible.svg', 80, 100),
  },
  {
    id: 'pump_dosing',
    category: 'pumps',
    subcategory: 'Metering & Dosing',
    name: 'Dosing Pump',
    description: 'Chemical dosing/metering pump with display',
    keywords: ['pump', 'dosing', 'metering', 'chemical', 'precision'],
    icon: '💉',
    thumbnail: '/symbols/pumps/pump-dosing.svg',
    template: svgTemplate('/symbols/pumps/pump-dosing.svg', 90, 100),
  },
  {
    id: 'pump_vacuum',
    category: 'pumps',
    subcategory: 'Vacuum Pumps',
    name: 'Vacuum Pump',
    description: 'Vacuum pump with gauge',
    keywords: ['pump', 'vacuum', 'suction', 'gauge'],
    icon: '🕳️',
    thumbnail: '/symbols/pumps/pump-vacuum.svg',
    template: svgTemplate('/symbols/pumps/pump-vacuum.svg', 100, 100),
  },

  // ═══════════════════════════════════════════════════════
  // TANKS (5) — Batch 2 ⭐ NEW
  // ═══════════════════════════════════════════════════════
  {
    id: 'tank_vertical',
    category: 'tanks',
    subcategory: 'Storage Tanks',
    name: 'Vertical Tank',
    description: 'Vertical storage tank with sight glass',
    keywords: ['tank', 'vertical', 'storage', 'cylinder', 'water'],
    icon: '🏗️',
    thumbnail: '/symbols/tanks/tank-vertical.svg',
    template: svgTemplate('/symbols/tanks/tank-vertical.svg', 90, 100),
  },
  {
    id: 'tank_horizontal',
    category: 'tanks',
    subcategory: 'Storage Tanks',
    name: 'Horizontal Tank',
    description: 'Horizontal cylindrical tank with saddles',
    keywords: ['tank', 'horizontal', 'cylinder', 'storage', 'saddle'],
    icon: '🛢️',
    thumbnail: '/symbols/tanks/tank-horizontal.svg',
    template: svgTemplate('/symbols/tanks/tank-horizontal.svg', 100, 100),
  },
  {
    id: 'tank_chemical',
    category: 'tanks',
    subcategory: 'Process Vessels',
    name: 'Chemical Tank',
    description: 'Chemical storage tank with hazard label',
    keywords: ['tank', 'chemical', 'hazard', 'corrosive', 'process'],
    icon: '⚗️',
    thumbnail: '/symbols/tanks/tank-chemical.svg',
    template: svgTemplate('/symbols/tanks/tank-chemical.svg', 100, 100),
  },
  {
    id: 'tank_fuel',
    category: 'tanks',
    subcategory: 'Fuel Tanks',
    name: 'Fuel Tank (Diesel)',
    description: 'Diesel/fuel storage tank with gauge',
    keywords: ['tank', 'fuel', 'diesel', 'gasoline', 'oil'],
    icon: '⛽',
    thumbnail: '/symbols/tanks/tank-fuel.svg',
    template: svgTemplate('/symbols/tanks/tank-fuel.svg', 100, 100),
  },
  {
    id: 'tank_water_tower',
    category: 'tanks',
    subcategory: 'Water Systems',
    name: 'Water Tower',
    description: 'Elevated water storage tower',
    keywords: ['tank', 'water', 'tower', 'elevated', 'H2O'],
    icon: '💧',
    thumbnail: '/symbols/tanks/tank-water-tower.svg',
    template: svgTemplate('/symbols/tanks/tank-water-tower.svg', 100, 100),
  },

  // ═══════════════════════════════════════════════════════
  // SENSORS (4) — Batch 3 ⭐ NEW
  // ═══════════════════════════════════════════════════════
  {
    id: 'sensor_temperature',
    category: 'sensors',
    subcategory: 'Temperature',
    name: 'Temperature Sensor',
    description: 'Thermometer with scale',
    keywords: ['sensor', 'temperature', 'thermometer', 'thermocouple', 'rtd'],
    icon: '🌡️',
    thumbnail: '/symbols/sensors/sensor-temperature.svg',
    template: svgTemplate('/symbols/sensors/sensor-temperature.svg', 80, 100),
  },
  {
    id: 'sensor_pressure',
    category: 'sensors',
    subcategory: 'Pressure',
    name: 'Pressure Gauge',
    description: 'Analog pressure gauge with color zones',
    keywords: ['sensor', 'pressure', 'gauge', 'manometer', 'bar', 'psi'],
    icon: '🔴',
    thumbnail: '/symbols/sensors/sensor-pressure.svg',
    template: svgTemplate('/symbols/sensors/sensor-pressure.svg', 100, 100),
  },
  {
    id: 'sensor_flow',
    category: 'sensors',
    subcategory: 'Flow',
    name: 'Flow Meter',
    description: 'Digital flow meter with display',
    keywords: ['sensor', 'flow', 'meter', 'flowmeter', 'volume'],
    icon: '🌊',
    thumbnail: '/symbols/sensors/sensor-flow.svg',
    template: svgTemplate('/symbols/sensors/sensor-flow.svg', 100, 100),
  },
  {
    id: 'sensor_level',
    category: 'sensors',
    subcategory: 'Level',
    name: 'Level Sensor',
    description: 'Ultrasonic level sensor with tank',
    keywords: ['sensor', 'level', 'ultrasonic', 'radar', 'liquid'],
    icon: '📏',
    thumbnail: '/symbols/sensors/sensor-level.svg',
    template: svgTemplate('/symbols/sensors/sensor-level.svg', 100, 100),
  },

  // ═══════════════════════════════════════════════════════
  // INDICATORS (3) — Batch 3 ⭐ NEW
  // ═══════════════════════════════════════════════════════
  {
    id: 'indicator_warning',
    category: 'indicators',
    subcategory: 'Warning Signs',
    name: 'Warning Triangle',
    description: 'Yellow warning/caution sign',
    keywords: ['indicator', 'warning', 'caution', 'triangle', 'safety'],
    icon: '⚠️',
    thumbnail: '/symbols/indicators/indicator-warning.svg',
    template: svgTemplate('/symbols/indicators/indicator-warning.svg', 80, 80),
  },
  {
    id: 'indicator_beacon',
    category: 'indicators',
    subcategory: 'Beacons',
    name: 'Rotating Beacon',
    description: 'Red rotating warning beacon',
    keywords: ['indicator', 'beacon', 'rotating', 'flashing', 'red', 'light'],
    icon: '🚨',
    thumbnail: '/symbols/indicators/indicator-beacon.svg',
    template: svgTemplate('/symbols/indicators/indicator-beacon.svg', 90, 100),
  },
  {
    id: 'indicator_alarm_bell',
    category: 'indicators',
    subcategory: 'Alarms',
    name: 'Alarm Bell',
    description: 'Audible alarm bell with sound waves',
    keywords: ['indicator', 'alarm', 'bell', 'sound', 'audible', 'siren'],
    icon: '🔔',
    thumbnail: '/symbols/indicators/indicator-alarm-bell.svg',
    template: svgTemplate('/symbols/indicators/indicator-alarm-bell.svg', 100, 100),
  },

  // ═══════════════════════════════════════════════════════
  // PIPING (3) — Batch 3 ⭐ NEW
  // ═══════════════════════════════════════════════════════
  {
    id: 'pipe_elbow',
    category: 'piping',
    subcategory: 'Fittings',
    name: 'Pipe Elbow (90°)',
    description: '90-degree pipe elbow with flanges',
    keywords: ['pipe', 'elbow', '90', 'bend', 'fitting', 'corner'],
    icon: '⤴️',
    thumbnail: '/symbols/misc/pipe-elbow.svg',
    template: svgTemplate('/symbols/misc/pipe-elbow.svg', 100, 100),
  },
  {
    id: 'pipe_tee',
    category: 'piping',
    subcategory: 'Fittings',
    name: 'Pipe T-Junction',
    description: '3-way pipe junction (Tee)',
    keywords: ['pipe', 'tee', 't-junction', '3-way', 'branch', 'fitting'],
    icon: '🔱',
    thumbnail: '/symbols/misc/pipe-tee.svg',
    template: svgTemplate('/symbols/misc/pipe-tee.svg', 100, 100),
  },
  {
    id: 'pipe_junction',
    category: 'piping',
    subcategory: 'Fittings',
    name: 'Pipe Cross (4-way)',
    description: '4-way pipe junction',
    keywords: ['pipe', 'cross', 'junction', '4-way', 'fitting', 'intersection'],
    icon: '➕',
    thumbnail: '/symbols/misc/pipe-junction.svg',
    template: svgTemplate('/symbols/misc/pipe-junction.svg', 100, 100),
  },


];

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export const getComponentsByCategory = (categoryId) => {
  return LIBRARY_COMPONENTS.filter((c) => c.category === categoryId);
};

export const getSubcategories = (categoryId) => {
  const components = getComponentsByCategory(categoryId);
  const subs = [...new Set(components.map((c) => c.subcategory))];
  return subs.sort();
};

export const searchComponents = (query) => {
  if (!query || query.trim() === '') return LIBRARY_COMPONENTS;
  const q = query.toLowerCase().trim();
  return LIBRARY_COMPONENTS.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q)) ||
      c.category.includes(q) ||
      c.subcategory.toLowerCase().includes(q)
    );
  });
};

export const getCategoryStats = () => {
  return LIBRARY_CATEGORIES.map((cat) => ({
    ...cat,
    count: LIBRARY_COMPONENTS.filter((c) => c.category === cat.id).length,
  }));
};

export const getComponentById = (id) => {
  return LIBRARY_COMPONENTS.find((c) => c.id === id) || null;
};