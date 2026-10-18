// ═══════════════════════════════════════════════════════════
// Element-Specific Properties Configuration
// Defines what appears in Property Panel for each element type
// ═══════════════════════════════════════════════════════════

export const getElementSpecificProperties = (elementType, element = {}) => {
  const configs = {
    motor: [
      { key: 'motorRPM', label: 'RPM', type: 'number', value: element.motorRPM ?? 1500, min: 0, max: 10000, dynamic: true, unit: 'rpm' },
      { key: 'motorDirection', label: 'Direction', type: 'select', value: element.motorDirection || 'Forward', options: ['Forward', 'Reverse', 'Stopped'], dynamic: true },
      { key: 'motorRunningColor', label: 'Running Color', type: 'color', value: element.motorRunningColor || '#10b981', dynamic: false },
      { key: 'motorStoppedColor', label: 'Stopped Color', type: 'color', value: element.motorStoppedColor || '#ef4444', dynamic: false },
      { key: 'motorFaultColor', label: 'Fault Color', type: 'color', value: element.motorFaultColor || '#f59e0b', dynamic: false },
      { key: 'motorShowLabel', label: 'Show Label', type: 'select', value: element.motorShowLabel !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'motorLabelText', label: 'Label Text', type: 'text', value: element.motorLabelText || 'MOTOR', dynamic: false },
    ],

    tank: [
      { key: 'tankMinLevel', label: 'Min Level', type: 'number', value: element.tankMinLevel ?? 0, dynamic: false, unit: '%' },
      { key: 'tankMaxLevel', label: 'Max Level', type: 'number', value: element.tankMaxLevel ?? 100, dynamic: false, unit: '%' },
      { key: 'tankWarningHigh', label: 'Warning High', type: 'number', value: element.tankWarningHigh ?? 90, dynamic: true, unit: '%' },
      { key: 'tankWarningLow', label: 'Warning Low', type: 'number', value: element.tankWarningLow ?? 10, dynamic: true, unit: '%' },
      { key: 'tankUnit', label: 'Unit', type: 'select', value: element.tankUnit || '%', options: ['%', 'L', 'm³', 'gal', 'ft³'], dynamic: false },
      { key: 'tankLiquidColor', label: 'Liquid Color', type: 'color', value: element.tankLiquidColor || '#06b6d4', dynamic: true },
      { key: 'tankShowPercentage', label: 'Show Value', type: 'select', value: element.tankShowPercentage !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'tankShowScale', label: 'Show Scale', type: 'select', value: element.tankShowScale ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    pump: [
      { key: 'pumpFlowRate', label: 'Flow Rate', type: 'number', value: element.pumpFlowRate ?? 0, dynamic: true, unit: 'L/min' },
      { key: 'pumpRPM', label: 'RPM', type: 'number', value: element.pumpRPM ?? 0, min: 0, dynamic: true, unit: 'rpm' },
      { key: 'pumpDirection', label: 'Flow Direction', type: 'select', value: element.pumpDirection || 'Discharge', options: ['Discharge', 'Suction'], dynamic: false },
      { key: 'pumpRunningColor', label: 'Running Color', type: 'color', value: element.pumpRunningColor || '#10b981', dynamic: false },
      { key: 'pumpStoppedColor', label: 'Stopped Color', type: 'color', value: element.pumpStoppedColor || '#ef4444', dynamic: false },
      { key: 'pumpShowLabel', label: 'Show Label', type: 'select', value: element.pumpShowLabel !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    valve: [
      { key: 'valveType', label: 'Valve Type', type: 'select', value: element.valveType || '2-Way', options: ['2-Way', '3-Way', 'Ball', 'Butterfly', 'Gate'], dynamic: false },
      { key: 'valvePosition', label: 'Position', type: 'number', value: element.valvePosition ?? 0, min: 0, max: 100, dynamic: true, unit: '%' },
      { key: 'valveOpenColor', label: 'Open Color', type: 'color', value: element.valveOpenColor || '#10b981', dynamic: false },
      { key: 'valveClosedColor', label: 'Closed Color', type: 'color', value: element.valveClosedColor || '#ef4444', dynamic: false },
      { key: 'valvePartialColor', label: 'Partial Color', type: 'color', value: element.valvePartialColor || '#f59e0b', dynamic: false },
      { key: 'valveShowPosition', label: 'Show Position %', type: 'select', value: element.valveShowPosition ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    bar: [
      { key: 'barMin', label: 'Min Value', type: 'number', value: element.barMin ?? 0, dynamic: false },
      { key: 'barMax', label: 'Max Value', type: 'number', value: element.barMax ?? 100, dynamic: false },
      { key: 'barOrientation', label: 'Orientation', type: 'select', value: element.barOrientation || 'Vertical', options: ['Vertical', 'Horizontal'], dynamic: false },
      { key: 'barDirection', label: 'Fill Direction', type: 'select', value: element.barDirection || 'BottomUp', options: ['BottomUp', 'TopDown', 'LeftRight', 'RightLeft'], dynamic: false },
      { key: 'barWarningHigh', label: 'Warning High', type: 'number', value: element.barWarningHigh ?? 80, dynamic: true },
      { key: 'barWarningLow', label: 'Warning Low', type: 'number', value: element.barWarningLow ?? 20, dynamic: true },
      { key: 'barNormalColor', label: 'Normal Color', type: 'color', value: element.barNormalColor || '#10b981', dynamic: false },
      { key: 'barWarningColor', label: 'Warning Color', type: 'color', value: element.barWarningColor || '#f59e0b', dynamic: false },
      { key: 'barCriticalColor', label: 'Critical Color', type: 'color', value: element.barCriticalColor || '#ef4444', dynamic: false },
      { key: 'barShowValue', label: 'Show Value', type: 'select', value: element.barShowValue !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'barShowScale', label: 'Show Scale', type: 'select', value: element.barShowScale ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    ioField: [
      { key: 'ioTargetTag', label: 'Target Tag', type: 'tag', value: element.ioTargetTag || '', dynamic: false },
      { key: 'ioFormat', label: 'Data Format', type: 'select', value: element.ioFormat || 'Decimal', options: ['Decimal', 'Integer', 'Hex', 'Binary', 'String', 'Boolean'], dynamic: false },
      { key: 'ioDecimals', label: 'Decimals', type: 'number', value: element.ioDecimals ?? 2, min: 0, max: 10, dynamic: false },
      { key: 'ioPrefix', label: 'Prefix', type: 'text', value: element.ioPrefix || '', dynamic: false, placeholder: 'e.g. $' },
      { key: 'ioSuffix', label: 'Suffix', type: 'text', value: element.ioSuffix || '', dynamic: false, placeholder: 'e.g. °C' },
      { key: 'ioReadOnly', label: 'Read-Only', type: 'select', value: element.ioReadOnly ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'ioMinValue', label: 'Min Value', type: 'number', value: element.ioMinValue ?? '', dynamic: false },
      { key: 'ioMaxValue', label: 'Max Value', type: 'number', value: element.ioMaxValue ?? '', dynamic: false },
      { key: 'ioTextAlign', label: 'Text Align', type: 'select', value: element.ioTextAlign || 'right', options: ['left', 'center', 'right'], dynamic: false },
      { key: 'ioRequireConfirm', label: 'Confirm on Write', type: 'select', value: element.ioRequireConfirm ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    numericDisplay: [
      { key: 'numFormat', label: 'Format', type: 'select', value: element.numFormat || 'Decimal', options: ['Decimal', 'Integer', 'Scientific', 'Percentage'], dynamic: false },
      { key: 'numDecimals', label: 'Decimals', type: 'number', value: element.numDecimals ?? 2, min: 0, max: 10, dynamic: false },
      { key: 'numThousandSep', label: 'Thousand Separator', type: 'select', value: element.numThousandSep ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'numPrefix', label: 'Prefix', type: 'text', value: element.numPrefix || '', dynamic: false, placeholder: 'e.g. $' },
      { key: 'numSuffix', label: 'Suffix', type: 'text', value: element.numSuffix || '', dynamic: false, placeholder: 'e.g. °C' },
      { key: 'numTextAlign', label: 'Text Align', type: 'select', value: element.numTextAlign || 'center', options: ['left', 'center', 'right'], dynamic: false },
    ],

    button: [
      { key: 'buttonType', label: 'Button Type', type: 'select', value: element.buttonType || 'Momentary', options: ['Momentary', 'Toggle', 'SetOnce', 'Reset'], dynamic: false },
      { key: 'buttonHoldRepeat', label: 'Hold to Repeat', type: 'select', value: element.buttonHoldRepeat ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'buttonRepeatDelay', label: 'Repeat Delay', type: 'number', value: element.buttonRepeatDelay ?? 500, min: 50, max: 5000, dynamic: false, unit: 'ms' },
      { key: 'buttonPressedColor', label: 'Pressed Color', type: 'color', value: element.buttonPressedColor || '#2563eb', dynamic: false },
      { key: 'buttonDisabledColor', label: 'Disabled Color', type: 'color', value: element.buttonDisabledColor || '#9ca3af', dynamic: false },
      { key: 'buttonIcon', label: 'Icon', type: 'select', value: element.buttonIcon || 'None', options: ['None', 'Play', 'Stop', 'Reset', 'Save', 'Delete', 'Edit'], dynamic: false },
    ],

    checkBox: [
      { key: 'checkBoxTargetTag', label: 'Target Tag', type: 'tag', value: element.checkBoxTargetTag || '', dynamic: false },
      { key: 'checkBoxLabel', label: 'Label', type: 'text', value: element.checkBoxLabel || '', dynamic: false, placeholder: 'e.g. Enable Motor' },
      { key: 'checkBoxLabelPosition', label: 'Label Position', type: 'select', value: element.checkBoxLabelPosition || 'right', options: ['left', 'right', 'top', 'bottom'], dynamic: false },
      { key: 'checkBoxRequireConfirm', label: 'Confirm on Change', type: 'select', value: element.checkBoxRequireConfirm ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'checkBoxConfirmMessage', label: 'Confirmation Text', type: 'text', value: element.checkBoxConfirmMessage || '', dynamic: false, placeholder: 'e.g. Really enable motor?' },
    ],

    radioButton: [
      { key: 'radioTargetTag', label: 'Target Tag', type: 'tag', value: element.radioTargetTag || '', dynamic: false },
      { key: 'radioValue', label: 'Value When Selected', type: 'text', value: element.radioValue ?? '', dynamic: false, placeholder: 'e.g. 1 or AUTO' },
      { key: 'radioLabel', label: 'Label', type: 'text', value: element.radioLabel || '', dynamic: false, placeholder: 'e.g. Auto Mode' },
      { key: 'radioLabelPosition', label: 'Label Position', type: 'select', value: element.radioLabelPosition || 'right', options: ['left', 'right', 'top', 'bottom'], dynamic: false },
      { key: 'radioRequireConfirm', label: 'Confirm on Change', type: 'select', value: element.radioRequireConfirm ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    comboBox: [
      { key: 'comboTargetTag', label: 'Target Tag', type: 'tag', value: element.comboTargetTag || '', dynamic: false },
      { key: 'comboOptions', label: 'Options', type: 'optionsList', value: element.comboOptions || [], dynamic: false },
      { key: 'comboPlaceholder', label: 'Placeholder', type: 'text', value: element.comboPlaceholder || 'Select...', dynamic: false },
      { key: 'comboRequireConfirm', label: 'Confirm on Change', type: 'select', value: element.comboRequireConfirm ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    listBox: [
      { key: 'listTargetTag', label: 'Target Tag', type: 'tag', value: element.listTargetTag || '', dynamic: false },
      { key: 'listOptions', label: 'Options', type: 'optionsList', value: element.listOptions || [], dynamic: false },
      { key: 'listSelectionColor', label: 'Selection Color', type: 'color', value: element.listSelectionColor || '#3b82f6', dynamic: false },
      { key: 'listRequireConfirm', label: 'Confirm on Change', type: 'select', value: element.listRequireConfirm ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
    ],

    // ─────────────────────────────────────────────────────
    // SVG SYMBOL — ✅ FIXED: symbolTintStrength defaults to 1
    // so that tint color is always visible at full strength.
    // Users can reduce it if they want partial tinting.
    // ─────────────────────────────────────────────────────
    svgSymbol: [
      { key: 'symbolId', label: 'Library Symbol', type: 'text', value: element.symbolId || '', readOnly: true, dynamic: false },
      { key: 'libraryVersion', label: 'Library Version', type: 'text', value: element.libraryVersion || 'legacy', readOnly: true, dynamic: false },
      { key: 'svgPath', label: 'SVG Source', type: 'text', value: element.svgPath || '', readOnly: true, dynamic: false },
      {
        key: 'symbolTint',
        label: 'Tint Color',
        type: 'color',
        // ✅ Default to a neutral blue so users can see something when they open properties
        value: element.symbolTint || '#3b82f6',
        dynamic: true,
      },
      {
        key: 'symbolTintStrength',
        label: 'Tint Strength (0=off, 1=full)',
        type: 'number',
        // ✅ KEY FIX: default to 1 (was 0 — caused tint to never show)
        value: element.symbolTintStrength ?? 1,
        min: 0, max: 1, step: 0.1,
        dynamic: true,
      },
      { key: 'symbolBrightness', label: 'Brightness', type: 'number', value: element.symbolBrightness ?? 1, min: 0.2, max: 2, step: 0.1, dynamic: true },
      { key: 'preserveAspect', label: 'Keep Aspect Ratio', type: 'select', value: element.preserveAspect !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'boundTag', label: 'Bound Tag', type: 'tag', value: element.boundTag || '', dynamic: false },
      { key: 'tooltip', label: 'Tooltip', type: 'text', value: element.tooltip || '', dynamic: false },
      { key: 'isVisible', label: 'Visible', type: 'select', value: element.isVisible !== false && element.isVisible !== 'No' ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: true },
    ],

    digitalClock: [
      { key: 'clockDisplayMode', label: 'Display Mode', type: 'select', value: element.clockDisplayMode || 'timeAndDate', options: ['timeOnly', 'dateOnly', 'timeAndDate', 'longFormat'], dynamic: false },
      { key: 'clockTimeFormat', label: 'Time Format', type: 'select', value: element.clockTimeFormat || '24h', options: ['24h', '12h'], dynamic: false },
      { key: 'clockShowSeconds', label: 'Show Seconds', type: 'select', value: element.clockShowSeconds !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'clockDateFormat', label: 'Date Format', type: 'select', value: element.clockDateFormat || 'DD/MM/YYYY', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'Long', 'Short'], dynamic: false },
      { key: 'clockShowTimezone', label: 'Show Timezone', type: 'select', value: element.clockShowTimezone ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'clockTimeSource', label: 'Time Source', type: 'select', value: element.clockTimeSource || 'local', options: ['local', 'server'], dynamic: false },
      { key: 'clockBackgroundColor', label: 'Background Color', type: 'color', value: element.clockBackgroundColor || '#081B43', dynamic: false },
      { key: 'clockTextColor', label: 'Text Color', type: 'color', value: element.clockTextColor || '#FFFFFF', dynamic: false },
      { key: 'clockAccentColor', label: 'Accent Color', type: 'color', value: element.clockAccentColor || '#2563EB', dynamic: false },
    ],

    trendControl: [
      { key: 'trendTitle', label: 'Title', type: 'text', value: element.trendTitle || 'Trend Chart', dynamic: false },
      { key: 'trendTags', label: 'Tags (comma-sep)', type: 'text', value: Array.isArray(element.trendTags) ? element.trendTags.join(',') : (element.trendTags || ''), dynamic: false, placeholder: 'Tag1,Tag2,Tag3' },
      { key: 'trendTimeRange', label: 'Time Range', type: 'select', value: element.trendTimeRange || '5m', options: ['1m', '5m', '15m', '1h', '6h', '24h'], dynamic: false },
      { key: 'trendUpdateInterval', label: 'Refresh (ms)', type: 'number', value: element.trendUpdateInterval ?? 2000, min: 500, max: 60000, dynamic: false },
      { key: 'trendYMin', label: 'Y-Axis Min (auto=blank)', type: 'number', value: element.trendYMin ?? '', dynamic: false },
      { key: 'trendYMax', label: 'Y-Axis Max (auto=blank)', type: 'number', value: element.trendYMax ?? '', dynamic: false },
      { key: 'trendShowLegend', label: 'Show Legend', type: 'select', value: element.trendShowLegend !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'trendShowGrid', label: 'Show Grid', type: 'select', value: element.trendShowGrid !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'trendShowAxis', label: 'Show Axis', type: 'select', value: element.trendShowAxis !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'trendBackgroundColor', label: 'Background', type: 'color', value: element.trendBackgroundColor || '#FFFFFF', dynamic: false },
      { key: 'trendTextColor', label: 'Text Color', type: 'color', value: element.trendTextColor || '#334155', dynamic: false },
    ],

    alarmControl: [
      { key: 'alarmTitle', label: 'Title', type: 'text', value: element.alarmTitle || 'Active Alarms', dynamic: false },
      { key: 'alarmMaxRows', label: 'Max Rows', type: 'number', value: element.alarmMaxRows ?? 50, min: 5, max: 500, dynamic: false },
      { key: 'alarmFilterPriority', label: 'Filter Priority', type: 'select', value: element.alarmFilterPriority || 'all', options: ['all', 'critical', 'high', 'medium', 'low'], dynamic: false },
      { key: 'alarmColorScheme', label: 'Color Scheme', type: 'select', value: element.alarmColorScheme || 'severity', options: ['severity', 'alternate', 'plain'], dynamic: false },
      { key: 'alarmRefreshInterval', label: 'Refresh (ms)', type: 'number', value: element.alarmRefreshInterval ?? 2000, min: 500, max: 30000, dynamic: false },
      { key: 'alarmBackgroundColor', label: 'Background', type: 'color', value: element.alarmBackgroundColor || '#FFFFFF', dynamic: false },
      { key: 'alarmHeaderColor', label: 'Header Color', type: 'color', value: element.alarmHeaderColor || '#081B43', dynamic: false },
      { key: 'alarmTextColor', label: 'Text Color', type: 'color', value: element.alarmTextColor || '#334155', dynamic: false },
    ],

    alarmHistoryControl: [
      { key: 'alarmHistTitle', label: 'Title', type: 'text', value: element.alarmHistTitle || 'Alarm History', dynamic: false },
      { key: 'alarmHistMaxRows', label: 'Max Rows', type: 'number', value: element.alarmHistMaxRows ?? 100, min: 10, max: 1000, dynamic: false },
      { key: 'alarmHistTimeRange', label: 'Time Range', type: 'select', value: element.alarmHistTimeRange || '24h', options: ['1h', '6h', '24h', '7d', '30d'], dynamic: false },
      { key: 'alarmHistFilterPriority', label: 'Filter Priority', type: 'select', value: element.alarmHistFilterPriority || 'all', options: ['all', 'critical', 'high', 'medium', 'low'], dynamic: false },
      { key: 'alarmHistBackgroundColor', label: 'Background', type: 'color', value: element.alarmHistBackgroundColor || '#FFFFFF', dynamic: false },
      { key: 'alarmHistHeaderColor', label: 'Header Color', type: 'color', value: element.alarmHistHeaderColor || '#081B43', dynamic: false },
      { key: 'alarmHistTextColor', label: 'Text Color', type: 'color', value: element.alarmHistTextColor || '#334155', dynamic: false },
    ],

    tableControl: [
      { key: 'tableTitle', label: 'Title', type: 'text', value: element.tableTitle || 'Data Table', dynamic: false },
      { key: 'tableTags', label: 'Tags (comma-sep)', type: 'text', value: Array.isArray(element.tableTags) ? element.tableTags.join(',') : (element.tableTags || ''), dynamic: false, placeholder: 'Tag1,Tag2,Tag3' },
      { key: 'tableRefreshInterval', label: 'Refresh (ms)', type: 'number', value: element.tableRefreshInterval ?? 1000, min: 250, max: 10000, dynamic: false },
      { key: 'tableShowHeader', label: 'Show Header', type: 'select', value: element.tableShowHeader !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'tableAlternateRows', label: 'Alternate Rows', type: 'select', value: element.tableAlternateRows !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'tableBackgroundColor', label: 'Background', type: 'color', value: element.tableBackgroundColor || '#FFFFFF', dynamic: false },
      { key: 'tableHeaderColor', label: 'Header BG', type: 'color', value: element.tableHeaderColor || '#081B43', dynamic: false },
      { key: 'tableTextColor', label: 'Text Color', type: 'color', value: element.tableTextColor || '#334155', dynamic: false },
      { key: 'tableBorderColor', label: 'Border Color', type: 'color', value: element.tableBorderColor || '#E5E7EB', dynamic: false },
    ],

    barChartControl: [
      { key: 'barChartTitle', label: 'Title', type: 'text', value: element.barChartTitle || 'Bar Chart', dynamic: false },
      { key: 'barChartTags', label: 'Tags (comma-sep)', type: 'text', value: Array.isArray(element.barChartTags) ? element.barChartTags.join(',') : (element.barChartTags || ''), dynamic: false, placeholder: 'Tag1,Tag2,Tag3' },
      { key: 'barChartOrientation', label: 'Orientation', type: 'select', value: element.barChartOrientation || 'vertical', options: ['vertical', 'horizontal'], dynamic: false },
      { key: 'barChartYMin', label: 'Y-Axis Min', type: 'number', value: element.barChartYMin ?? 0, dynamic: false },
      { key: 'barChartYMax', label: 'Y-Axis Max', type: 'number', value: element.barChartYMax ?? 100, dynamic: false },
      { key: 'barChartShowValues', label: 'Show Values', type: 'select', value: element.barChartShowValues !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'barChartShowLegend', label: 'Show Legend', type: 'select', value: element.barChartShowLegend ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'barChartRefreshInterval', label: 'Refresh (ms)', type: 'number', value: element.barChartRefreshInterval ?? 1000, min: 250, max: 10000, dynamic: false },
      { key: 'barChartBackgroundColor', label: 'Background', type: 'color', value: element.barChartBackgroundColor || '#FFFFFF', dynamic: false },
      { key: 'barChartTextColor', label: 'Text Color', type: 'color', value: element.barChartTextColor || '#334155', dynamic: false },
    ],

    webFrameControl: [
      { key: 'webTitle', label: 'Title', type: 'text', value: element.webTitle || 'Web Frame', dynamic: false },
      { key: 'webUrl', label: 'URL', type: 'text', value: element.webUrl || 'https://www.example.com', dynamic: false, placeholder: 'https://...' },
      { key: 'webShowBorder', label: 'Show Border', type: 'select', value: element.webShowBorder !== false ? 'Yes' : 'No', options: ['Yes', 'No'], dynamic: false },
      { key: 'webBorderColor', label: 'Border Color', type: 'color', value: element.webBorderColor || '#E5E7EB', dynamic: false },
    ],
  };

  return configs[elementType] || [];
};

export const hasElementSpecificProperties = (type) => {
  return [
    'motor', 'tank', 'pump', 'valve', 'bar',
    'ioField', 'numericDisplay', 'button',
    'checkBox', 'radioButton', 'comboBox', 'listBox',
    'svgSymbol', 'digitalClock',
    'trendControl', 'alarmControl', 'alarmHistoryControl',
    'tableControl', 'barChartControl', 'webFrameControl',
  ].includes(type);
};

export const getElementLabel = (type) => {
  const labels = {
    rectangle: 'Rectangle', circle: 'Circle', ellipse: 'Ellipse',
    line: 'Line', text: 'Static Text', motor: 'Motor', tank: 'Tank',
    pump: 'Pump', valve: 'Valve', gauge: 'Gauge', indicator: 'Indicator',
    bar: 'Bar Graph', ioField: 'I/O Field', numericDisplay: 'Numeric Display',
    textDisplay: 'Text Display', button: 'Button', checkBox: 'Check Box',
    radioButton: 'Radio Button', roundButton: 'Round Button',
    statusDisplay: 'Status Display', comboBox: 'Combo Box', listBox: 'List Box',
    pipe: 'Pipe', conveyor: 'Conveyor', svgSymbol: 'SVG Symbol',
    digitalClock: 'Digital Clock', trendControl: 'Trend Chart',
    alarmControl: 'Alarm List', alarmHistoryControl: 'Alarm History',
    tableControl: 'Data Table', barChartControl: 'Bar Chart',
    webFrameControl: 'Web Frame',
  };
  return labels[type] || type;
};
