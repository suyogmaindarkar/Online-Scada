// Original industrial symbol library inspired by the supplied SVG-library
// screenshots. These assets are authored for WebSCADA and are not copied from
// WinCC. Legacy SVG files remain on disk so existing saved screens can render,
// but legacy entries are intentionally no longer exposed in the library UI.

export const LIBRARY_VERSION = 'industrial-original-v2';

export const LIBRARY_CATEGORIES = [
  { id: 'general', label: 'General', icon: 'Shapes', color: '#64748b' },
  { id: 'buildings', label: 'Buildings & Cabinets', icon: 'Monitor', color: '#475569' },
  { id: 'process', label: 'Process Equipment', icon: 'Workflow', color: '#0f766e' },
  { id: 'piping', label: 'Pipes & Fittings', icon: 'GitBranch', color: '#64748b' },
  { id: 'valves', label: 'Valves', icon: 'Wrench', color: '#b45309' },
  { id: 'pumps', label: 'Pumps', icon: 'Droplets', color: '#0891b2' },
  { id: 'motors', label: 'Motors & Drives', icon: 'Cog', color: '#7c3aed' },
  { id: 'tanks', label: 'Tanks & Vessels', icon: 'Cylinder', color: '#059669' },
  { id: 'instrumentation', label: 'Flow Meters & Sensors', icon: 'Gauge', color: '#2563eb' },
  { id: 'controls', label: 'Operating Controls', icon: 'SlidersHorizontal', color: '#c026d3' },
  { id: 'signal_lamps', label: 'Signal Lamps', icon: 'Lightbulb', color: '#ca8a04' },
  { id: 'safety', label: 'Safety & Overlays', icon: 'ShieldAlert', color: '#dc2626' },
  { id: 'electrical', label: 'Electrical', icon: 'Zap', color: '#a16207' },
];

const svgTemplate = (svgPath, width = 100, height = 100, extras = {}) => ({
  type: 'svgSymbol',
  svgPath,
  width,
  height,
  rotation: 0,
  opacity: 1,
  symbolTint: null,
  symbolTintStrength: 1,
  symbolBrightness: 1,
  preserveAspect: true,
  boundTag: null,
  tooltip: '',
  isVisible: true,
  libraryVersion: LIBRARY_VERSION,
  ...extras,
});

const symbol = (id, category, subcategory, name, description, keywords, icon, svgPath, width, height, extras) => ({
  id,
  category,
  subcategory,
  name,
  description,
  keywords,
  icon,
  thumbnail: svgPath,
  template: svgTemplate(svgPath, width, height, {
    symbolId: id,
    objectName: name,
    ...extras,
  }),
});

export const LIBRARY_COMPONENTS = [
  // General layout and annotation objects.
  symbol('general_process_boundary', 'general', 'Layout', 'Process Boundary', 'Dashed area boundary for a process section', ['general', 'boundary', 'area', 'layout'], 'Shapes', '/symbols/general/process-boundary.svg', 140, 90),
  symbol('general_note_callout', 'general', 'Annotations', 'Operator Callout', 'Industrial annotation callout for equipment notes', ['general', 'note', 'callout', 'annotation'], 'MessageSquare', '/symbols/general/operator-callout.svg', 120, 70),

  // Plant hierarchy objects from the reference library categories.
  symbol('building_control_room', 'buildings', 'Buildings', 'Control Room', 'Simple plant control-room block', ['building', 'control', 'room', 'plant'], 'Monitor', '/symbols/industrial/control-room.svg', 120, 90),
  symbol('cabinet_drive_panel', 'buildings', 'Cabinets', 'Drive Cabinet', 'Electrical drive and control cabinet', ['cabinet', 'drive', 'panel', 'electrical'], 'Monitor', '/symbols/industrial/drive-cabinet.svg', 90, 120),

  // Process equipment.
  symbol('process_heat_exchanger', 'process', 'Heat Transfer', 'Plate Heat Exchanger', 'Compact plate heat exchanger with flow ports', ['process', 'heat', 'exchanger', 'plate', 'thermal'], 'Workflow', '/symbols/process/heat-exchanger.svg', 110, 100),
  symbol('process_filter', 'process', 'Separation', 'Process Filter', 'Inline basket filter with drain connection', ['process', 'filter', 'strainer', 'separation'], 'Filter', '/symbols/process/process-filter.svg', 100, 100),
  symbol('process_vessel', 'process', 'Brewing & Chemical', 'Process Vessel', 'Agitated process vessel with jacket and drain', ['process', 'vessel', 'mixer', 'chemical', 'brewery'], 'Cylinder', '/symbols/industrial/process-vessel.svg', 110, 130),
  symbol('process_mixer', 'process', 'Mixers', 'Top-entry Mixer', 'Process mixer with motor and shaft', ['mixer', 'agitator', 'process', 'tank'], 'Cog', '/symbols/industrial/process-mixer.svg', 100, 130),

  // Piping and flow overlays.
  symbol('pipe_horizontal_run', 'piping', 'Pipe Runs', 'Horizontal Pipe', 'Horizontal pipe run with flange ends', ['pipe', 'horizontal', 'run', 'flange'], 'GitBranch', '/symbols/industrial/pipe-horizontal.svg', 150, 50),
  symbol('pipe_vertical_run', 'piping', 'Pipe Runs', 'Vertical Pipe', 'Vertical pipe run with flange ends', ['pipe', 'vertical', 'run', 'flange'], 'GitBranch', '/symbols/industrial/pipe-vertical.svg', 50, 150),
  symbol('pipe_elbow_original', 'piping', 'Fittings', '90 Degree Elbow', 'Original 90-degree pipe elbow', ['pipe', 'elbow', '90', 'fitting'], 'GitBranch', '/symbols/industrial/pipe-elbow.svg', 100, 100),
  symbol('pipe_tee_original', 'piping', 'Fittings', 'Pipe Tee', 'Original three-way pipe tee', ['pipe', 'tee', 'junction', 'fitting'], 'GitBranch', '/symbols/industrial/pipe-tee.svg', 100, 100),
  symbol('pipe_flow_arrow', 'piping', 'Overlays & Arrows', 'Flow Arrow', 'Directional flow overlay for a pipe run', ['pipe', 'flow', 'arrow', 'direction'], 'ArrowRight', '/symbols/industrial/flow-arrow.svg', 100, 40),

  // Valves and actuators.
  symbol('valve_hand_original', 'valves', 'Manual Valves', 'Hand Valve', 'Manual hand-wheel valve', ['valve', 'hand', 'manual', 'wheel'], 'Wrench', '/symbols/industrial/hand-valve.svg', 100, 100),
  symbol('instrumentation_control_valve', 'valves', 'Control Valves', 'Control Valve', 'Pneumatic control valve with positioner', ['valve', 'control', 'pneumatic', 'positioner'], 'Wrench', '/symbols/instrumentation/control-valve.svg', 100, 110),
  symbol('valve_safety_shutoff', 'valves', 'Safety Valves', 'Safety Shutoff Valve', 'Actuated safety shutoff valve', ['valve', 'safety', 'shutoff', 'actuator'], 'ShieldAlert', '/symbols/industrial/safety-shutoff.svg', 110, 110),

  // Rotating equipment.
  symbol('pump_inline_original', 'pumps', 'Pumps', 'Inline Pump', 'Inline centrifugal pump with motor', ['pump', 'centrifugal', 'inline', 'motor'], 'Droplets', '/symbols/industrial/inline-pump.svg', 130, 90),
  symbol('pump_end_suction_original', 'pumps', 'Centrifugal Pumps', 'End-Suction Pump', 'Original end-suction centrifugal pump with motor and base', ['pump', 'centrifugal', 'end suction', 'motor'], 'Droplets', '/symbols/pumps/pump-end-suction-original.svg', 160, 110),
  symbol('pump_vertical_inline_original', 'pumps', 'Vertical Pumps', 'Vertical Inline Pump', 'Original vertical inline process pump', ['pump', 'vertical', 'inline', 'process'], 'Droplets', '/symbols/pumps/pump-vertical-inline-original.svg', 110, 160),
  symbol('pump_split_case_original', 'pumps', 'Centrifugal Pumps', 'Split-Case Pump', 'Original horizontal split-case centrifugal pump', ['pump', 'split case', 'centrifugal', 'horizontal'], 'Droplets', '/symbols/pumps/pump-split-case-original.svg', 180, 105),
  symbol('pump_dosing_original', 'pumps', 'Metering Pumps', 'Dosing Pump', 'Original compact chemical dosing pump', ['pump', 'dosing', 'metering', 'chemical'], 'Droplets', '/symbols/pumps/pump-dosing-original.svg', 120, 150),
  symbol('pump_magnetic_original', 'pumps', 'Specialty Pumps', 'Magnetic-Drive Pump', 'Original sealless magnetic-drive process pump', ['pump', 'magnetic', 'sealless', 'chemical'], 'Droplets', '/symbols/pumps/pump-magnetic-original.svg', 155, 105),
  symbol('motor_horizontal_original', 'motors', 'Motors', 'Horizontal Motor', 'Horizontal motor with terminal box', ['motor', 'drive', 'horizontal', 'electric'], 'Cog', '/symbols/industrial/horizontal-motor.svg', 120, 80),
  symbol('tank_conical_original', 'tanks', 'Tanks', 'Conical Tank', 'Vertical conical-bottom process tank', ['tank', 'conical', 'vessel', 'storage'], 'Cylinder', '/symbols/industrial/conical-tank.svg', 100, 140),

  // Flow measurement and field instrumentation.
  symbol('instrumentation_transmitter', 'instrumentation', 'Transmitters', 'Pressure Transmitter', 'Field pressure transmitter with impulse line', ['instrumentation', 'pressure', 'transmitter', 'field'], 'Gauge', '/symbols/instrumentation/pressure-transmitter.svg', 90, 110),
  symbol('instrumentation_flow_meter', 'instrumentation', 'Flow Meters', 'Magnetic Flow Meter', 'Inline magnetic flow meter with transmitter head', ['flow', 'meter', 'magnetic', 'instrumentation'], 'Gauge', '/symbols/industrial/magnetic-flow-meter.svg', 120, 100),
  symbol('instrumentation_ultrasonic_meter', 'instrumentation', 'Flow Meters', 'Ultrasonic Flow Meter', 'Clamp-on ultrasonic flow meter', ['flow', 'meter', 'ultrasonic', 'instrumentation'], 'Gauge', '/symbols/industrial/ultrasonic-flow-meter.svg', 110, 110),
  symbol('instrumentation_pressure_gauge', 'instrumentation', 'Sensors', 'Pressure Gauge', 'Analog field pressure gauge', ['sensor', 'pressure', 'gauge', 'analog'], 'Gauge', '/symbols/industrial/pressure-gauge.svg', 90, 90),

  // Operator controls.
  symbol('control_pushbutton', 'controls', 'Operating Controls', 'Pushbutton', 'Momentary operator pushbutton control', ['control', 'pushbutton', 'operator', 'momentary'], 'CircleDot', '/symbols/controls/pushbutton.svg', 90, 90),
  symbol('control_selector', 'controls', 'Operating Controls', 'Selector Switch', 'Three-position manual/auto selector', ['control', 'selector', 'switch', 'manual', 'auto'], 'ToggleRight', '/symbols/controls/selector-switch.svg', 100, 100),
  symbol('control_emergency_stop', 'controls', 'Operating Controls', 'Emergency Stop', 'Emergency stop control with guarded button', ['control', 'emergency', 'stop', 'operator'], 'ShieldAlert', '/symbols/industrial/emergency-stop.svg', 100, 100),

  // Signal and safety overlays.
  symbol('signal_stack_light', 'signal_lamps', 'Signal Lamps', 'Stack Light', 'Three-colour machine status lamp', ['signal', 'lamp', 'stack', 'status', 'light'], 'Lightbulb', '/symbols/industrial/stack-light.svg', 70, 130),
  symbol('signal_alarm_beacon', 'signal_lamps', 'Signal Lamps', 'Alarm Beacon', 'Rotating red alarm beacon', ['signal', 'beacon', 'alarm', 'light'], 'Lightbulb', '/symbols/industrial/alarm-beacon.svg', 90, 110),
  symbol('safety_warning_overlay', 'safety', 'Status Overlays', 'Warning Overlay', 'High-visibility warning overlay', ['safety', 'warning', 'overlay', 'alarm'], 'ShieldAlert', '/symbols/industrial/warning-overlay.svg', 100, 100),

  // Single-line electrical symbols.
  symbol('electrical_breaker', 'electrical', 'Protection', 'Circuit Breaker', 'Single-line circuit breaker symbol', ['electrical', 'breaker', 'protection', 'switchgear'], 'Zap', '/symbols/electrical/circuit-breaker.svg', 80, 100),
  symbol('electrical_transformer', 'electrical', 'Power Distribution', 'Transformer', 'Two-winding transformer for single-line diagrams', ['electrical', 'transformer', 'power', 'distribution'], 'Zap', '/symbols/electrical/transformer.svg', 110, 100),
];

export const getComponentsByCategory = (categoryId) => (
  LIBRARY_COMPONENTS.filter((component) => component.category === categoryId)
);

export const getSubcategories = (categoryId) => (
  [...new Set(getComponentsByCategory(categoryId).map((component) => component.subcategory))].sort()
);

export const searchComponents = (query) => {
  if (!query || query.trim() === '') return LIBRARY_COMPONENTS;
  const normalizedQuery = query.toLowerCase().trim();
  return LIBRARY_COMPONENTS.filter((component) => (
    component.name.toLowerCase().includes(normalizedQuery)
    || component.description.toLowerCase().includes(normalizedQuery)
    || component.keywords.some((keyword) => keyword.includes(normalizedQuery))
    || component.category.includes(normalizedQuery)
    || component.subcategory.toLowerCase().includes(normalizedQuery)
  ));
};

export const getCategoryStats = () => (
  LIBRARY_CATEGORIES.map((category) => ({
    ...category,
    count: getComponentsByCategory(category.id).length,
  }))
);

export const getComponentById = (id) => (
  LIBRARY_COMPONENTS.find((component) => component.id === id) || null
);
