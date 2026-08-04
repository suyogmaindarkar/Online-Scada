// ═══════════════════════════════════════════════════════════
// Element-Specific Properties Configuration
// Defines what appears in Property Panel for each element type
// ═══════════════════════════════════════════════════════════

/**
 * Returns element-specific properties for the given type
 * These add to the standard Geometry/Colors/Styles/etc.
 */
export const getElementSpecificProperties = (elementType, element = {}) => {
  const configs = {
    // ─────────────────────────────────────────────────────
    // MOTOR — running state, RPM, direction
    // ─────────────────────────────────────────────────────
    motor: [
      { key: 'motorRPM', label: 'RPM', type: 'number',
        value: element.motorRPM ?? 1500, min: 0, max: 10000, dynamic: true, unit: 'rpm' },
      { key: 'motorDirection', label: 'Direction', type: 'select',
        value: element.motorDirection || 'Forward',
        options: ['Forward', 'Reverse', 'Stopped'], dynamic: true },
      { key: 'motorRunningColor', label: 'Running Color', type: 'color',
        value: element.motorRunningColor || '#10b981', dynamic: false },
      { key: 'motorStoppedColor', label: 'Stopped Color', type: 'color',
        value: element.motorStoppedColor || '#ef4444', dynamic: false },
      { key: 'motorFaultColor', label: 'Fault Color', type: 'color',
        value: element.motorFaultColor || '#f59e0b', dynamic: false },
      { key: 'motorShowLabel', label: 'Show Label', type: 'select',
        value: element.motorShowLabel !== false ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'motorLabelText', label: 'Label Text', type: 'text',
        value: element.motorLabelText || 'MOTOR', dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // TANK — level, capacity, warnings
    // ─────────────────────────────────────────────────────
    tank: [
      { key: 'tankMinLevel', label: 'Min Level', type: 'number',
        value: element.tankMinLevel ?? 0, dynamic: false, unit: '%' },
      { key: 'tankMaxLevel', label: 'Max Level', type: 'number',
        value: element.tankMaxLevel ?? 100, dynamic: false, unit: '%' },
      { key: 'tankWarningHigh', label: 'Warning High', type: 'number',
        value: element.tankWarningHigh ?? 90, dynamic: true, unit: '%' },
      { key: 'tankWarningLow', label: 'Warning Low', type: 'number',
        value: element.tankWarningLow ?? 10, dynamic: true, unit: '%' },
      { key: 'tankUnit', label: 'Unit', type: 'select',
        value: element.tankUnit || '%',
        options: ['%', 'L', 'm³', 'gal', 'ft³'], dynamic: false },
      { key: 'tankLiquidColor', label: 'Liquid Color', type: 'color',
        value: element.tankLiquidColor || '#06b6d4', dynamic: true },
      { key: 'tankShowPercentage', label: 'Show Value', type: 'select',
        value: element.tankShowPercentage !== false ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'tankShowScale', label: 'Show Scale', type: 'select',
        value: element.tankShowScale ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // PUMP — flow, RPM, direction
    // ─────────────────────────────────────────────────────
    pump: [
      { key: 'pumpFlowRate', label: 'Flow Rate', type: 'number',
        value: element.pumpFlowRate ?? 0, dynamic: true, unit: 'L/min' },
      { key: 'pumpRPM', label: 'RPM', type: 'number',
        value: element.pumpRPM ?? 0, min: 0, dynamic: true, unit: 'rpm' },
      { key: 'pumpDirection', label: 'Flow Direction', type: 'select',
        value: element.pumpDirection || 'Discharge',
        options: ['Discharge', 'Suction'], dynamic: false },
      { key: 'pumpRunningColor', label: 'Running Color', type: 'color',
        value: element.pumpRunningColor || '#10b981', dynamic: false },
      { key: 'pumpStoppedColor', label: 'Stopped Color', type: 'color',
        value: element.pumpStoppedColor || '#ef4444', dynamic: false },
      { key: 'pumpShowLabel', label: 'Show Label', type: 'select',
        value: element.pumpShowLabel !== false ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // VALVE — position, type
    // ─────────────────────────────────────────────────────
    valve: [
      { key: 'valveType', label: 'Valve Type', type: 'select',
        value: element.valveType || '2-Way',
        options: ['2-Way', '3-Way', 'Ball', 'Butterfly', 'Gate'], dynamic: false },
      { key: 'valvePosition', label: 'Position', type: 'number',
        value: element.valvePosition ?? 0, min: 0, max: 100, dynamic: true, unit: '%' },
      { key: 'valveOpenColor', label: 'Open Color', type: 'color',
        value: element.valveOpenColor || '#10b981', dynamic: false },
      { key: 'valveClosedColor', label: 'Closed Color', type: 'color',
        value: element.valveClosedColor || '#ef4444', dynamic: false },
      { key: 'valvePartialColor', label: 'Partial Color', type: 'color',
        value: element.valvePartialColor || '#f59e0b', dynamic: false },
      { key: 'valveShowPosition', label: 'Show Position %', type: 'select',
        value: element.valveShowPosition ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // BAR — bar chart properties
    // ─────────────────────────────────────────────────────
    bar: [
      { key: 'barMin', label: 'Min Value', type: 'number',
        value: element.barMin ?? 0, dynamic: false },
      { key: 'barMax', label: 'Max Value', type: 'number',
        value: element.barMax ?? 100, dynamic: false },
      { key: 'barOrientation', label: 'Orientation', type: 'select',
        value: element.barOrientation || 'Vertical',
        options: ['Vertical', 'Horizontal'], dynamic: false },
      { key: 'barDirection', label: 'Fill Direction', type: 'select',
        value: element.barDirection || 'BottomUp',
        options: ['BottomUp', 'TopDown', 'LeftRight', 'RightLeft'], dynamic: false },
      { key: 'barWarningHigh', label: 'Warning High', type: 'number',
        value: element.barWarningHigh ?? 80, dynamic: true },
      { key: 'barWarningLow', label: 'Warning Low', type: 'number',
        value: element.barWarningLow ?? 20, dynamic: true },
      { key: 'barNormalColor', label: 'Normal Color', type: 'color',
        value: element.barNormalColor || '#10b981', dynamic: false },
      { key: 'barWarningColor', label: 'Warning Color', type: 'color',
        value: element.barWarningColor || '#f59e0b', dynamic: false },
      { key: 'barCriticalColor', label: 'Critical Color', type: 'color',
        value: element.barCriticalColor || '#ef4444', dynamic: false },
      { key: 'barShowValue', label: 'Show Value', type: 'select',
        value: element.barShowValue !== false ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'barShowScale', label: 'Show Scale', type: 'select',
        value: element.barShowScale ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // I/O FIELD — data entry field (Sprint D4: interactive)
    // ─────────────────────────────────────────────────────
    ioField: [
      { key: 'ioTargetTag', label: 'Target Tag', type: 'tag',
        value: element.ioTargetTag || '', dynamic: false },
      { key: 'ioFormat', label: 'Data Format', type: 'select',
        value: element.ioFormat || 'Decimal',
        options: ['Decimal', 'Integer', 'Hex', 'Binary', 'String', 'Boolean'], dynamic: false },
      { key: 'ioDecimals', label: 'Decimals', type: 'number',
        value: element.ioDecimals ?? 2, min: 0, max: 10, dynamic: false },
      { key: 'ioPrefix', label: 'Prefix', type: 'text',
        value: element.ioPrefix || '', dynamic: false, placeholder: 'e.g. $' },
      { key: 'ioSuffix', label: 'Suffix', type: 'text',
        value: element.ioSuffix || '', dynamic: false, placeholder: 'e.g. °C' },
      { key: 'ioReadOnly', label: 'Read-Only', type: 'select',
        value: element.ioReadOnly ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'ioMinValue', label: 'Min Value', type: 'number',
        value: element.ioMinValue ?? '', dynamic: false },
      { key: 'ioMaxValue', label: 'Max Value', type: 'number',
        value: element.ioMaxValue ?? '', dynamic: false },
      { key: 'ioTextAlign', label: 'Text Align', type: 'select',
        value: element.ioTextAlign || 'right',
        options: ['left', 'center', 'right'], dynamic: false },
      { key: 'ioRequireConfirm', label: 'Confirm on Write', type: 'select',
        value: element.ioRequireConfirm ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // NUMERIC DISPLAY — read-only value display
    // ─────────────────────────────────────────────────────
    numericDisplay: [
      { key: 'numFormat', label: 'Format', type: 'select',
        value: element.numFormat || 'Decimal',
        options: ['Decimal', 'Integer', 'Scientific', 'Percentage'], dynamic: false },
      { key: 'numDecimals', label: 'Decimals', type: 'number',
        value: element.numDecimals ?? 2, min: 0, max: 10, dynamic: false },
      { key: 'numThousandSep', label: 'Thousand Separator', type: 'select',
        value: element.numThousandSep ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'numPrefix', label: 'Prefix', type: 'text',
        value: element.numPrefix || '', dynamic: false, placeholder: 'e.g. $' },
      { key: 'numSuffix', label: 'Suffix', type: 'text',
        value: element.numSuffix || '', dynamic: false, placeholder: 'e.g. °C' },
      { key: 'numTextAlign', label: 'Text Align', type: 'select',
        value: element.numTextAlign || 'center',
        options: ['left', 'center', 'right'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // BUTTON — button behavior
    // ─────────────────────────────────────────────────────
    button: [
      { key: 'buttonType', label: 'Button Type', type: 'select',
        value: element.buttonType || 'Momentary',
        options: ['Momentary', 'Toggle', 'SetOnce', 'Reset'], dynamic: false },
      { key: 'buttonHoldRepeat', label: 'Hold to Repeat', type: 'select',
        value: element.buttonHoldRepeat ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'buttonRepeatDelay', label: 'Repeat Delay', type: 'number',
        value: element.buttonRepeatDelay ?? 500, min: 50, max: 5000, dynamic: false, unit: 'ms' },
      { key: 'buttonPressedColor', label: 'Pressed Color', type: 'color',
        value: element.buttonPressedColor || '#2563eb', dynamic: false },
      { key: 'buttonDisabledColor', label: 'Disabled Color', type: 'color',
        value: element.buttonDisabledColor || '#9ca3af', dynamic: false },
      { key: 'buttonIcon', label: 'Icon', type: 'select',
        value: element.buttonIcon || 'None',
        options: ['None', 'Play', 'Stop', 'Reset', 'Save', 'Delete', 'Edit'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // CHECKBOX — Interactive toggle (Sprint D4)
    // ─────────────────────────────────────────────────────
    checkBox: [
      { key: 'checkBoxTargetTag', label: 'Target Tag', type: 'tag',
        value: element.checkBoxTargetTag || '', dynamic: false },
      { key: 'checkBoxLabel', label: 'Label', type: 'text',
        value: element.checkBoxLabel || '', dynamic: false, placeholder: 'e.g. Enable Motor' },
      { key: 'checkBoxLabelPosition', label: 'Label Position', type: 'select',
        value: element.checkBoxLabelPosition || 'right',
        options: ['left', 'right', 'top', 'bottom'], dynamic: false },
      { key: 'checkBoxRequireConfirm', label: 'Confirm on Change', type: 'select',
        value: element.checkBoxRequireConfirm ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
      { key: 'checkBoxConfirmMessage', label: 'Confirmation Text', type: 'text',
        value: element.checkBoxConfirmMessage || '', dynamic: false,
        placeholder: 'e.g. Really enable motor?' },
    ],

    // ─────────────────────────────────────────────────────
    // RADIO BUTTON — Interactive selector (Sprint D4)
    // ─────────────────────────────────────────────────────
    radioButton: [
      { key: 'radioTargetTag', label: 'Target Tag', type: 'tag',
        value: element.radioTargetTag || '', dynamic: false },
      { key: 'radioValue', label: 'Value When Selected', type: 'text',
        value: element.radioValue ?? '', dynamic: false, placeholder: 'e.g. 1 or AUTO' },
      { key: 'radioLabel', label: 'Label', type: 'text',
        value: element.radioLabel || '', dynamic: false, placeholder: 'e.g. Auto Mode' },
      { key: 'radioLabelPosition', label: 'Label Position', type: 'select',
        value: element.radioLabelPosition || 'right',
        options: ['left', 'right', 'top', 'bottom'], dynamic: false },
      { key: 'radioRequireConfirm', label: 'Confirm on Change', type: 'select',
        value: element.radioRequireConfirm ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // COMBO BOX — Dropdown selector (Sprint D4)
    // ─────────────────────────────────────────────────────
    comboBox: [
      { key: 'comboTargetTag', label: 'Target Tag', type: 'tag',
        value: element.comboTargetTag || '', dynamic: false },
      { key: 'comboOptions', label: 'Options', type: 'optionsList',
        value: element.comboOptions || [], dynamic: false },
      { key: 'comboPlaceholder', label: 'Placeholder', type: 'text',
        value: element.comboPlaceholder || 'Select...', dynamic: false },
      { key: 'comboRequireConfirm', label: 'Confirm on Change', type: 'select',
        value: element.comboRequireConfirm ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // LIST BOX — List of clickable options (Sprint D4)
    // ─────────────────────────────────────────────────────
    listBox: [
      { key: 'listTargetTag', label: 'Target Tag', type: 'tag',
        value: element.listTargetTag || '', dynamic: false },
      { key: 'listOptions', label: 'Options', type: 'optionsList',
        value: element.listOptions || [], dynamic: false },
      { key: 'listSelectionColor', label: 'Selection Color', type: 'color',
        value: element.listSelectionColor || '#3b82f6', dynamic: false },
      { key: 'listRequireConfirm', label: 'Confirm on Change', type: 'select',
        value: element.listRequireConfirm ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // SVG SYMBOL — Component Library elements (Sprint F)
    // Bindable properties: tint color, tint strength, brightness
    // ─────────────────────────────────────────────────────
    svgSymbol: [
      { key: 'svgPath', label: 'SVG Source', type: 'text',
        value: element.svgPath || '', readOnly: true, dynamic: false },
      { key: 'symbolTint', label: 'Tint Color', type: 'color',
        value: element.symbolTint || '#3b82f6', dynamic: true },
      { key: 'symbolTintStrength', label: 'Tint Strength', type: 'number',
        value: element.symbolTintStrength ?? 0, min: 0, max: 1, step: 0.1, dynamic: true },
      { key: 'symbolBrightness', label: 'Brightness', type: 'number',
        value: element.symbolBrightness ?? 1, min: 0.2, max: 2, step: 0.1, dynamic: true },
      { key: 'preserveAspect', label: 'Keep Aspect Ratio', type: 'select',
        value: element.preserveAspect !== false ? 'Yes' : 'No',
        options: ['Yes', 'No'], dynamic: false },
    ],
  };

  return configs[elementType] || [];
};

/**
 * Returns whether an element type has element-specific properties
 */
export const hasElementSpecificProperties = (type) => {
  return [
    'motor', 'tank', 'pump', 'valve', 'bar',
    'ioField', 'numericDisplay', 'button',
    'checkBox', 'radioButton', 'comboBox', 'listBox',
    'svgSymbol',
  ].includes(type);
};

/**
 * Get friendly label for element type
 */
export const getElementLabel = (type) => {
  const labels = {
    rectangle: 'Rectangle',
    circle: 'Circle',
    ellipse: 'Ellipse',
    line: 'Line',
    text: 'Static Text',
    motor: 'Motor',
    tank: 'Tank',
    pump: 'Pump',
    valve: 'Valve',
    gauge: 'Gauge',
    indicator: 'Indicator',
    bar: 'Bar Graph',
    ioField: 'I/O Field',
    numericDisplay: 'Numeric Display',
    textDisplay: 'Text Display',
    button: 'Button',
    checkBox: 'Check Box',
    radioButton: 'Radio Button',
    roundButton: 'Round Button',
    statusDisplay: 'Status Display',
    comboBox: 'Combo Box',
    listBox: 'List Box',
    pipe: 'Pipe',
    conveyor: 'Conveyor',
    svgSymbol: 'SVG Symbol',
  };
  return labels[type] || type;
};