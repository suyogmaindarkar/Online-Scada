import { Stage, Layer, Rect, Circle, Line, Text, Group, RegularPolygon, Ellipse, Arc, Path } from 'react-konva';
import { useEffect, useState, useRef } from 'react';
import Konva from 'konva';
import { tagAPI } from '../../services/api';
import { resolveElementBindings } from '../../utils/bindingUtils';
import { executeEvent, normalizeActions } from '../../utils/eventUtils';
import { writeInteractiveValue, valuesEqual, parseOptions } from '../../utils/interactiveUtils';
import InteractiveOverlay from './InteractiveOverlay';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Image as KonvaImage } from 'react-konva';
import useImage from '../../hooks/useImage';
import { useServerTime } from '../../context/ServerTimeContext';
import { ProcessPictureWidget, isProcessPicture } from '../widgets/ProcessPictureWidgets';

const RuntimeCanvas = ({
  elements,
  width,
  height,
  backgroundColor,
  liveValues = {},
  tags = [],
  screens = [],
  onChangeScreen,
  onOpenPopup,        // ✅ NEW
  onClosePopup,
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const prevLiveValuesRef = useRef({});
  const [flashState, setFlashState] = useState(false);
  const flashIntervalRef = useRef(null);
  const [pressedButtons, setPressedButtons] = useState({});
  const { serverTime } = useServerTime();
  const [localTime, setLocalTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setLocalTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let fastestSpeed = 500;
    elements.forEach((el) => {
      if (el.animation?.enabled && el.animation?.type === 'flash' && el.animation?.flashSpeed) {
        const speed = parseInt(el.animation.flashSpeed);
        if (speed && speed < fastestSpeed) fastestSpeed = speed;
      }
    });
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    flashIntervalRef.current = setInterval(() => setFlashState((p) => !p), fastestSpeed);
    return () => { if (flashIntervalRef.current) clearInterval(flashIntervalRef.current); };
  }, [elements]);

  const runEvent = async (element, eventName) => {
    const eventValue = element?.events?.[eventName];
    const actions = normalizeActions(eventValue);
    if (actions.length === 0) return;

        const context = {
      liveValues,
      navigate,
      showToast: (msg, type) => toast.showToast(msg, type),
      showConfirm: ({ title, message, onConfirm }) => {
        if (window.confirm(message)) onConfirm();
      },
      currentElement: element,
      allElements: elements,
      changeScreen: (screenName) => {
        if (onChangeScreen) onChangeScreen(screenName);
        else console.warn('[RuntimeCanvas] onChangeScreen not provided');
      },
      // ✅ NEW: popup handlers
      openPopup: (popupName) => {
        if (onOpenPopup) onOpenPopup(popupName);
        else console.warn('[RuntimeCanvas] onOpenPopup not provided');
      },
      closePopup: () => {
        if (onClosePopup) onClosePopup();
        else console.warn('[RuntimeCanvas] onClosePopup not provided');
      },
    };

    try {
      await executeEvent(eventValue, context);
    } catch (err) {
      console.error(`Event ${eventName} failed:`, err);
    }
  };

  useEffect(() => {
    const prevValues = prevLiveValuesRef.current;
    const changedTags = new Set();
    for (const [tagName, value] of Object.entries(liveValues)) {
      if (prevValues[tagName] !== value) changedTags.add(tagName);
    }
    if (changedTags.size === 0) { prevLiveValuesRef.current = { ...liveValues }; return; }

    elements.forEach((el) => {
      if (!el.events?.onValueChange) return;
      const elementTags = new Set();
      if (el.boundTag) elementTags.add(el.boundTag);
      if (el.dynamicBindings) Object.values(el.dynamicBindings).forEach((b) => { if (b?.tag) elementTags.add(b.tag); });
      const hasChange = [...elementTags].some((t) => changedTags.has(t));
      if (hasChange) runEvent(el, 'onValueChange');
    });
    prevLiveValuesRef.current = { ...liveValues };
  }, [liveValues, elements]);

  const handleButtonPress = async (el) => {
    if (!el.action?.targetTag && !el.buttonType) return;
    setPressedButtons((prev) => ({ ...prev, [el.id]: true }));
    const type = el.buttonType || 'Momentary';
    const targetTag = el.action?.targetTag;
    if (!targetTag) return;
    try {
      if (type === 'Momentary') await tagAPI.writeValue(targetTag, true);
      else if (type === 'Toggle') await tagAPI.writeValue(targetTag, !liveValues[targetTag]);
      else if (type === 'SetOnce') await tagAPI.writeValue(targetTag, el.action.targetValue ?? true);
      else if (type === 'Reset') await tagAPI.writeValue(targetTag, false);
    } catch (err) { console.error('Button press failed:', err); }
  };

  const handleButtonRelease = async (el) => {
    setPressedButtons((prev) => ({ ...prev, [el.id]: false }));
    const type = el.buttonType || 'Momentary';
    if (type === 'Momentary' && el.action?.targetTag) {
      try { await tagAPI.writeValue(el.action.targetTag, false); }
      catch (err) { console.error('Button release failed:', err); }
    }
  };

  const handleCheckBoxClick = async (el) => {
    if (!el.checkBoxTargetTag) { toast.warning('CheckBox has no target tag'); return; }
    await writeInteractiveValue({
      targetTag: el.checkBoxTargetTag, value: !liveValues[el.checkBoxTargetTag], tags,
      requireConfirm: !!el.checkBoxRequireConfirm,
      confirmMessage: el.checkBoxConfirmMessage || `Set ${el.checkBoxTargetTag}?`,
      showToast: (msg, type) => toast.showToast(msg, type),
    });
  };

  const handleRadioButtonClick = async (el) => {
    if (!el.radioTargetTag) { toast.warning('RadioButton has no target tag'); return; }
    await writeInteractiveValue({
      targetTag: el.radioTargetTag, value: el.radioValue, tags,
      requireConfirm: !!el.radioRequireConfirm,
      confirmMessage: `Set ${el.radioTargetTag} to "${el.radioValue}"?`,
      showToast: (msg, type) => toast.showToast(msg, type),
    });
  };

  const handleListBoxItemClick = async (el, optionValue) => {
    if (!el.listTargetTag) { toast.warning('ListBox has no target tag'); return; }
    await writeInteractiveValue({
      targetTag: el.listTargetTag, value: optionValue, tags,
      requireConfirm: !!el.listRequireConfirm,
      confirmMessage: `Select "${optionValue}"?`,
      showToast: (msg, type) => toast.showToast(msg, type),
    });
  };

  const renderElement = (originalEl, overlayHandlers = {}) => {
    const el = resolveElementBindings(originalEl, liveValues, []);
    const liveValue = el.boundTag ? liveValues[el.boundTag] : null;

    // ✅ Process pictures are rendered as HTML overlays — skip Konva rendering
    if (isProcessPicture(el.type)) return null;

    let fillColor = normalizeColor(el.fill);
    let isVisible = true;

    if (el.dynamicBindings?.isVisible) {
      const boundTag = el.dynamicBindings.isVisible.tag;
      const tagVal = liveValues[boundTag];
      if (tagVal !== undefined && tagVal !== null) {
        const binding = el.dynamicBindings.isVisible;
        if (binding.mode === 'boolMap') {
          isVisible = tagVal ? (binding.trueValue !== false) : (binding.falseValue !== false);
        } else {
          isVisible = !!tagVal;
        }
      }
    } else if (el.boundTag && liveValue !== null && liveValue !== undefined) {
      if (el.animation?.enabled && el.animation?.type === 'visibility') {
        if (typeof liveValue === 'boolean') isVisible = liveValue;
        else if (typeof liveValue === 'number') isVisible = liveValue >= (parseFloat(el.animation.minValue) || 0);
      }
    }

    if (el.isVisible === false || el.isVisible === 'No') isVisible = false;
    if (!isVisible) return null;

    if (el.boundTag && liveValue !== null && liveValue !== undefined) {
      if (el.animation?.enabled && el.animation?.type === 'color') {
        if (typeof liveValue === 'boolean') {
          fillColor = liveValue ? normalizeColor(el.animation.maxColor) || '#10b981' : normalizeColor(el.animation.minColor) || '#ef4444';
        } else if (typeof liveValue === 'number') {
          const min = parseFloat(el.animation.minValue) || 0;
          const max = parseFloat(el.animation.maxValue) || 100;
          if (liveValue >= max) fillColor = normalizeColor(el.animation.maxColor) || '#10b981';
          else if (liveValue <= min) fillColor = normalizeColor(el.animation.minColor) || '#ef4444';
          else fillColor = interpolateColor(normalizeColor(el.animation.minColor) || '#ef4444', normalizeColor(el.animation.maxColor) || '#10b981', (liveValue - min) / (max - min));
        }
      }
      if (el.animation?.enabled && el.animation?.type === 'flash') {
        let shouldFlash = typeof liveValue === 'boolean' ? liveValue === true : liveValue >= (parseFloat(el.animation.flashThreshold) || 80);
        if (shouldFlash) {
          fillColor = flashState ? normalizeColor(el.animation.flashColor1) || '#ef4444' : normalizeColor(el.animation.flashColor2) || '#fbbf24';
        }
      }
    }

    const hasClickEvent = !!el.events?.onClick || el.type === 'button' || !!el.action?.targetTag ||
      !!el.checkBoxTargetTag || !!el.radioTargetTag || !!el.listTargetTag || !!el.comboTargetTag || !!el.ioTargetTag;

    const commonProps = {
      x: el.x, y: el.y, draggable: false,
      onClick: async (e) => {
        e.cancelBubble = true;
        await runEvent(el, 'onClick');
        if (el.type === 'button' && el.action?.targetTag && !el.events?.onClick) {
          try {
            let value = el.action.targetValue;
            if (value === undefined || value === '') value = !liveValue;
            await tagAPI.writeValue(el.action.targetTag, value);
          } catch (err) { console.error('Button action failed:', err); }
        }
      },
      onTap: async (e) => { e.cancelBubble = true; await runEvent(el, 'onClick'); },
      onDblClick: async (e) => { e.cancelBubble = true; await runEvent(el, 'onDoubleClick'); },
      onDblTap: async (e) => { e.cancelBubble = true; await runEvent(el, 'onDoubleClick'); },
      onMouseDown: async (e) => {
        if (e.evt?.button === 0) await runEvent(el, 'onPressLeft');
        else if (e.evt?.button === 2) await runEvent(el, 'onPressRight');
      },
      onMouseUp: async (e) => {
        if (e.evt?.button === 0) await runEvent(el, 'onReleaseLeft');
        else if (e.evt?.button === 2) await runEvent(el, 'onReleaseRight');
      },
      onMouseEnter: async (e) => {
        const container = e.target.getStage().container();
        container.style.cursor = hasClickEvent ? 'pointer' : 'default';
        await runEvent(el, 'onMouseEnter');
      },
      onMouseLeave: async (e) => {
        const container = e.target.getStage().container();
        container.style.cursor = 'default';
        await runEvent(el, 'onMouseLeave');
      },
      stroke: normalizeColor(el.stroke),
      strokeWidth: el.strokeWidth || 0,
      opacity: el.opacity ?? 1,
      rotation: el.rotation || 0,
    };

    switch (el.type) {
      case 'rectangle':
        return <Rect key={el.id} {...commonProps} width={el.width} height={el.height} fill={fillColor} cornerRadius={el.cornerRadius || 4} />;

      case 'circle':
        return <Circle key={el.id} {...commonProps} radius={el.width / 2} fill={fillColor} />;

      case 'line':
        return <Line key={el.id} {...commonProps} points={[0, 0, el.width, 0]} stroke={fillColor || normalizeColor(el.stroke)} strokeWidth={el.strokeWidth || 2} />;

      case 'text':
        return <Text key={el.id} {...commonProps} text={el.text || 'Text'} fontSize={el.fontSize || 16} fill={normalizeColor(el.fontColor) || '#000000'} fontFamily="Arial" />;

      case 'tank': {
        const minLevel = el.tankMinLevel ?? 0; const maxLevel = el.tankMaxLevel ?? 100;
        const warningHigh = el.tankWarningHigh ?? 90; const warningLow = el.tankWarningLow ?? 10;
        const currentLevel = liveValue !== null && liveValue !== undefined ? Math.min(Math.max(Number(liveValue), minLevel), maxLevel) : 0;
        const fillRatio = maxLevel !== minLevel ? (currentLevel - minLevel) / (maxLevel - minLevel) : 0;
        let liquidColor = normalizeColor(el.tankLiquidColor) || '#06b6d4';
        if (currentLevel >= warningHigh) liquidColor = '#f59e0b';
        if (currentLevel >= warningHigh * 1.05) liquidColor = '#ef4444';
        if (currentLevel <= warningLow) liquidColor = '#fbbf24';
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#1e293b" stroke="#475569" strokeWidth={3} cornerRadius={[10,10,0,0]} />
            {liveValue !== null && liveValue !== undefined && (
              <Rect x={3} y={el.height * (1 - fillRatio)} width={el.width - 6} height={el.height * fillRatio} fill={liquidColor} />
            )}
            {el.tankShowScale && (<Line points={[0, el.height*(1-(warningHigh-minLevel)/(maxLevel-minLevel)), el.width, el.height*(1-(warningHigh-minLevel)/(maxLevel-minLevel))]} stroke="#f59e0b" strokeWidth={1} dash={[4,2]} />)}
            {el.tankShowScale && (<Line points={[0, el.height*(1-(warningLow-minLevel)/(maxLevel-minLevel)), el.width, el.height*(1-(warningLow-minLevel)/(maxLevel-minLevel))]} stroke="#fbbf24" strokeWidth={1} dash={[4,2]} />)}
            {el.tankShowPercentage !== false && (<Text x={0} y={el.height+5} width={el.width} text={liveValue !== null && liveValue !== undefined ? `${Number(liveValue).toFixed(1)} ${el.tankUnit||'%'}` : 'TANK'} fontSize={12} fill="#1a1612" align="center" fontStyle="bold" />)}
          </Group>
        );
      }

      case 'pump':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width/2} y={el.height/2} radius={el.width/2} fill={el.boundTag && liveValue !== null ? liveValue ? '#10b981' : '#ef4444' : fillColor||'#475569'} stroke="#1e293b" strokeWidth={3} shadowBlur={liveValue?15:0} shadowColor={liveValue?'#10b981':'transparent'} />
            <Text x={0} y={el.height/2-8} width={el.width} text="P" fontSize={24} fontStyle="bold" fill="#ffffff" align="center" />
            <Text x={0} y={el.height+5} width={el.width} text={liveValue?'PUMP ON':'PUMP OFF'} fontSize={11} fill="#000000" align="center" fontStyle="bold" />
          </Group>
        );

      case 'motor': {
        const isRunning = el.boundTag && liveValue;
        const motorColor = isRunning ? normalizeColor(el.motorRunningColor)||'#10b981' : normalizeColor(el.motorStoppedColor)||'#ef4444';
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={el.boundTag?motorColor:fillColor} cornerRadius={8} shadowBlur={isRunning?12:0} shadowColor={motorColor} />
            <Text x={0} y={el.height/2-14} width={el.width} text="M" fontSize={28} fontStyle="bold" fill="#ffffff" align="center" />
            {isRunning && el.motorRPM && (<Text x={0} y={el.height/2+6} width={el.width} text={`${el.motorRPM} RPM`} fontSize={9} fill="#ffffff" align="center" fontFamily="monospace" />)}
            {el.motorShowLabel !== false && (<Text x={0} y={el.height+5} width={el.width} text={el.motorLabelText||'MOTOR'} fontSize={11} fill="#1a1612" align="center" fontStyle="bold" />)}
          </Group>
        );
      }

      case 'indicator': {
        const indicatorActive = el.boundTag && liveValue !== null && liveValue !== undefined ? !!liveValue : false;
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width/2} y={el.height/2} radius={el.width/2} fill={indicatorActive?'#10b981':'#374151'} stroke="#1e293b" strokeWidth={2} shadowBlur={indicatorActive?20:0} shadowColor={indicatorActive?'#10b981':'transparent'} />
            <Circle x={el.width/2} y={el.height/2} radius={el.width/3} fill={indicatorActive?'#34d399':'#475569'} />
          </Group>
        );
      }

      case 'gauge':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width/2} y={el.height/2} radius={el.width/2} fill="#1e293b" stroke="#475569" strokeWidth={3} />
            <Text x={0} y={el.height/2-12} width={el.width} text={liveValue !== null && liveValue !== undefined ? Math.round(Number(liveValue)).toString():'0'} fontSize={24} fontStyle="bold" fill="#3b82f6" align="center" />
            <Text x={0} y={el.height/2+12} width={el.width} text="GAUGE" fontSize={10} fill="#94a3b8" align="center" />
          </Group>
        );

      case 'numericDisplay': {
        let displayText = '0';
        if (liveValue !== null && liveValue !== undefined) {
          const num = Number(liveValue); const decimals = el.numDecimals ?? 2;
          if (el.numFormat==='Integer') displayText = Math.round(num).toString();
          else if (el.numFormat==='Scientific') displayText = num.toExponential(decimals);
          else if (el.numFormat==='Percentage') displayText = (num*100).toFixed(decimals)+'%';
          else displayText = num.toFixed(decimals);
          if (el.numThousandSep && el.numFormat!=='Scientific') {
            const parts = displayText.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,','); displayText = parts.join('.');
          }
        }
        const fullText = `${el.numPrefix||''}${displayText}${el.numSuffix||''}`;
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#0f172a'} stroke="#3b82f6" strokeWidth={2} cornerRadius={4} />
            <Text x={0} y={el.height/2-12} width={el.width} text={fullText} fontSize={20} fontStyle="bold" fill={normalizeColor(el.fontColor)||'#3b82f6'} align={el.numTextAlign||'center'} fontFamily="monospace" />
          </Group>
        );
      }

      case 'textDisplay':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#0f172a" stroke="#475569" strokeWidth={1} cornerRadius={4} />
            <Text x={5} y={el.height/2-8} width={el.width-10} text={liveValue !== null && liveValue !== undefined ? String(liveValue) : el.text||'---'} fontSize={14} fill="#ffffff" align="left" />
          </Group>
        );

      case 'button': {
        const isPressed = pressedButtons[el.id];
        const buttonIcon = el.buttonIcon || 'None';
        const iconPaths = {
          Play:'M8 5v14l11-7z', Stop:'M6 6h12v12H6z',
          Reset:'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
          Save:'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
          Delete:'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
          Edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
          Power:'M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z',
          Alert:'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
        };
        const toggledOn = el.buttonType==='Toggle' && el.action?.targetTag && liveValues[el.action.targetTag]===true;
        const showPressed = isPressed || toggledOn;
        const bgColor = showPressed ? normalizeColor(el.buttonPressedColor)||'#2563eb' : fillColor||'#3b82f6';
        return (
          <Group key={el.id} {...commonProps}
            onMouseDown={async (e) => {
              if (e.evt?.button===0) { await runEvent(el,'onPressLeft'); handleButtonPress(el); }
              else if (e.evt?.button===2) await runEvent(el,'onPressRight');
            }}
            onMouseUp={async (e) => {
              if (e.evt?.button===0) { await runEvent(el,'onReleaseLeft'); handleButtonRelease(el); }
              else if (e.evt?.button===2) await runEvent(el,'onReleaseRight');
            }}
            onMouseLeave={async (e) => {
              const container = e.target.getStage().container(); container.style.cursor='default';
              await runEvent(el,'onMouseLeave');
              if (isPressed) handleButtonRelease(el);
            }}
            onTouchStart={() => handleButtonPress(el)}
            onTouchEnd={() => handleButtonRelease(el)}>
            <Rect width={el.width} height={el.height} fill={bgColor} cornerRadius={6} shadowColor="black" shadowBlur={showPressed?2:8} shadowOpacity={showPressed?0.2:0.4} shadowOffsetY={showPressed?1:3} y={showPressed?1:0} />
            {buttonIcon!=='None' && iconPaths[buttonIcon] && (<Path x={el.text?el.width/2-40:el.width/2-10} y={el.height/2-10+(showPressed?1:0)} data={iconPaths[buttonIcon]} fill={normalizeColor(el.fontColor)||'#ffffff'} scale={{x:0.83,y:0.83}} />)}
            <Text x={buttonIcon!=='None'&&iconPaths[buttonIcon]?20:0} y={el.height/2-8+(showPressed?1:0)} width={buttonIcon!=='None'&&iconPaths[buttonIcon]?el.width-20:el.width} text={el.text||'BUTTON'} fontSize={el.fontSize||14} fontStyle="bold" fill={normalizeColor(el.fontColor)||'#ffffff'} align="center" />
            {toggledOn && (<Circle x={el.width-10} y={10} radius={3} fill="#10b981" shadowBlur={4} shadowColor="#10b981" />)}
          </Group>
        );
      }

      case 'ellipse':
        return <Ellipse key={el.id} {...commonProps} radiusX={el.width/2} radiusY={el.height/2} offsetX={-el.width/2} offsetY={-el.height/2} fill={fillColor} />;

      case 'polygon':
        return <RegularPolygon key={el.id} {...commonProps} sides={el.sides||5} radius={el.width/2} offsetX={-el.width/2} offsetY={-el.height/2} fill={fillColor} />;

      case 'polyline':
        return <Line key={el.id} {...commonProps} points={[0,0,el.width/2,el.height,el.width,0]} stroke={fillColor||normalizeColor(el.stroke)} strokeWidth={el.strokeWidth||2} closed={false} />;

      case 'ellipseArc': case 'circularArc':
        return <Arc key={el.id} {...commonProps} innerRadius={0} outerRadius={el.width/2} angle={270} offsetX={-el.width/2} offsetY={-el.height/2} fill={fillColor} />;

      case 'roundedRectangle':
        return <Rect key={el.id} {...commonProps} width={el.width} height={el.height} fill={fillColor} cornerRadius={el.cornerRadius||16} />;

      case 'connector':
        return <Line key={el.id} {...commonProps} points={[0,0,el.width,0]} stroke={normalizeColor(el.stroke)||'#7a6f60'} strokeWidth={el.strokeWidth||2} dash={[4,4]} />;

      case 'ioField': {
        const ioValue = el.ioTargetTag ? liveValues[el.ioTargetTag] : liveValue;
        let displayText = '0';
        if (ioValue !== null && ioValue !== undefined) {
          const num = Number(ioValue); const decimals = el.ioDecimals ?? 2;
          if (el.ioFormat==='Integer') displayText = Math.round(num).toString();
          else if (el.ioFormat==='Hex') displayText = '0x'+Math.round(num).toString(16).toUpperCase();
          else if (el.ioFormat==='Binary') displayText = Math.round(num).toString(2);
          else if (el.ioFormat==='Boolean') displayText = ioValue?'TRUE':'FALSE';
          else if (el.ioFormat==='String') displayText = String(ioValue);
          else displayText = num.toFixed(decimals);
        }
        const fullText = `${el.ioPrefix||''}${displayText}${el.ioSuffix||''}`;
        const isEditable = !el.ioReadOnly && el.ioTargetTag;
        return (
          <Group key={el.id} {...commonProps}
            onClick={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (isEditable && overlayHandlers.openIoFieldOverlay) overlayHandlers.openIoFieldOverlay(el); }}
            onTap={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (isEditable && overlayHandlers.openIoFieldOverlay) overlayHandlers.openIoFieldOverlay(el); }}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#f5f0e8'} stroke={isEditable?'#3b82f6':normalizeColor(el.stroke)||'#c9a876'} strokeWidth={isEditable?2:1} cornerRadius={2} />
            <Text x={4} y={el.height/2-6} width={el.width-8} text={fullText} fontSize={el.fontSize||14} fill={normalizeColor(el.fontColor)||'#1a1612'} fontFamily="monospace" align={el.ioTextAlign||'right'} fontStyle={isEditable?'bold':'normal'} />
            {isEditable && (<Text x={el.width-12} y={2} text="✎" fontSize={8} fill="#3b82f6" opacity={0.6} />)}
          </Group>
        );
      }

      case 'bar': {
        const min = el.barMin??0; const max = el.barMax??100;
        const warningHigh = el.barWarningHigh??80; const warningLow = el.barWarningLow??20;
        const current = liveValue !== null && liveValue !== undefined ? Math.min(Math.max(Number(liveValue),min),max) : (min+max)/2;
        const ratio = max!==min?(current-min)/(max-min):0.5;
        let barColor = normalizeColor(el.barNormalColor)||'#10b981';
        if (current>=warningHigh||current<=warningLow) barColor = normalizeColor(el.barWarningColor)||'#f59e0b';
        if (current>=max*0.95||current<=min*1.05) barColor = normalizeColor(el.barCriticalColor)||'#ef4444';
        const isVertical = (el.barOrientation||'Vertical')==='Vertical';
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#f5f0e8" stroke="#c9a876" strokeWidth={1} cornerRadius={2} />
            {isVertical ? (<Rect x={2} y={el.height-(el.height-4)*ratio} width={el.width-4} height={(el.height-4)*ratio} fill={barColor} />) : (<Rect x={2} y={2} width={(el.width-4)*ratio} height={el.height-4} fill={barColor} />)}
            {el.barShowValue!==false && (<Text x={0} y={el.height+5} width={el.width} text={liveValue !== null && liveValue !== undefined ? `${Number(liveValue).toFixed(1)}` : `${((min+max)/2).toFixed(1)}`} fontSize={11} fill="#1a1612" align="center" fontStyle="bold" />)}
          </Group>
        );
      }

      case 'graphicObject':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#e8e0d0'} stroke="#c9a876" strokeWidth={1} dash={[6,4]} />
            <Text x={0} y={el.height/2-6} width={el.width} text="Graphic" fontSize={11} fill="#7a6f60" align="center" />
          </Group>
        );

      case 'statusDisplay':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#0f172a'} stroke="#3b82f6" strokeWidth={1} cornerRadius={2} />
            <Circle x={12} y={el.height/2} radius={5} fill={liveValue?'#10b981':'#ef4444'} shadowBlur={8} shadowColor={liveValue?'#10b981':'#ef4444'} />
            <Text x={24} y={el.height/2-6} width={el.width-30} text={liveValue !== null && liveValue !== undefined ? liveValue?'ONLINE':'OFFLINE' : el.text||'STATUS'} fontSize={12} fill={normalizeColor(el.fontColor)||'#10b981'} fontStyle="bold" fontFamily="monospace" />
          </Group>
        );

      case 'comboBox': {
        const options = parseOptions(el.comboOptions);
        const currentValue = el.comboTargetTag ? liveValues[el.comboTargetTag] : undefined;
        const matched = options.find((o) => valuesEqual(o.value, currentValue));
        const displayLabel = matched ? matched.label : (currentValue !== undefined && currentValue !== null ? String(currentValue) : el.comboPlaceholder||'Select...');
        const hasTarget = !!el.comboTargetTag;
        return (
          <Group key={el.id} {...commonProps}
            onClick={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget && overlayHandlers.openComboBoxOverlay) overlayHandlers.openComboBoxOverlay(el); }}
            onTap={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget && overlayHandlers.openComboBoxOverlay) overlayHandlers.openComboBoxOverlay(el); }}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#ffffff'} stroke={hasTarget?'#3b82f6':normalizeColor(el.stroke)||'#c9a876'} strokeWidth={hasTarget?2:1} cornerRadius={2} />
            <Text x={6} y={el.height/2-6} width={el.width-24} text={displayLabel} fontSize={11} fill={matched?'#1a1612':'#7a6f60'} fontStyle={matched?'bold':'normal'} />
            <Line points={[el.width-14,el.height/2-3,el.width-10,el.height/2+3,el.width-6,el.height/2-3]} stroke="#3b82f6" strokeWidth={1.5} />
          </Group>
        );
      }

      case 'listBox': {
        const options = parseOptions(el.listOptions);
        const currentValue = el.listTargetTag ? liveValues[el.listTargetTag] : undefined;
        const selectionColor = normalizeColor(el.listSelectionColor)||'#3b82f6';
        const itemsToRender = options.length>0?options:[{label:'Option A',value:'A'},{label:'Option B',value:'B'},{label:'Option C',value:'C'}];
        const itemHeight = 20;
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#ffffff'} stroke={normalizeColor(el.stroke)||'#c9a876'} strokeWidth={1} cornerRadius={2} />
            {itemsToRender.map((opt, i) => {
              const isSelected = valuesEqual(opt.value, currentValue);
              const yPos = 4+i*itemHeight;
              if (yPos+itemHeight>el.height) return null;
              return (
                <Group key={i}
                  onClick={async (e) => { e.cancelBubble=true; await handleListBoxItemClick(el, opt.value); }}
                  onTap={async (e) => { e.cancelBubble=true; await handleListBoxItemClick(el, opt.value); }}
                  onMouseEnter={(e) => { e.target.getStage().container().style.cursor='pointer'; }}
                  onMouseLeave={(e) => { e.target.getStage().container().style.cursor='default'; }}>
                  {isSelected && (<Rect x={2} y={yPos-2} width={el.width-4} height={itemHeight} fill={selectionColor} opacity={0.2} cornerRadius={2} />)}
                  <Text x={6} y={yPos} width={el.width-12} text={opt.label} fontSize={11} fill={isSelected?selectionColor:'#1a1612'} fontStyle={isSelected?'bold':'normal'} />
                </Group>
              );
            })}
          </Group>
        );
      }

      case 'checkBox': {
        const currentValue = el.checkBoxTargetTag ? liveValues[el.checkBoxTargetTag] : liveValue;
        const isChecked = !!currentValue; const hasTarget = !!el.checkBoxTargetTag;
        return (
          <Group key={el.id} {...commonProps}
            onClick={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget) await handleCheckBoxClick(el); }}
            onTap={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget) await handleCheckBoxClick(el); }}>
            <Rect width={el.width} height={el.height} fill="#ffffff" stroke={hasTarget?'#3b82f6':normalizeColor(el.stroke)||'#c9a876'} strokeWidth={2} cornerRadius={2} />
            {isChecked && (<Line points={[el.width*0.2,el.height*0.5,el.width*0.45,el.height*0.75,el.width*0.8,el.height*0.25]} stroke="#10b981" strokeWidth={3} lineCap="round" />)}
            {el.checkBoxLabel && (<Text x={el.width+6} y={el.height/2-6} text={el.checkBoxLabel} fontSize={12} fill="#1a1612" />)}
          </Group>
        );
      }

      case 'radioButton': {
        const currentValue = el.radioTargetTag ? liveValues[el.radioTargetTag] : liveValue;
        const isSelected = valuesEqual(el.radioValue, currentValue); const hasTarget = !!el.radioTargetTag;
        return (
          <Group key={el.id} {...commonProps}
            onClick={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget) await handleRadioButtonClick(el); }}
            onTap={async (e) => { e.cancelBubble=true; await runEvent(el,'onClick'); if (hasTarget) await handleRadioButtonClick(el); }}>
            <Circle x={el.width/2} y={el.height/2} radius={el.width/2} fill="#ffffff" stroke={hasTarget?'#3b82f6':normalizeColor(el.stroke)||'#c9a876'} strokeWidth={2} />
            {isSelected && (<Circle x={el.width/2} y={el.height/2} radius={el.width/4} fill="#3b82f6" />)}
            {el.radioLabel && (<Text x={el.width+6} y={el.height/2-6} text={el.radioLabel} fontSize={12} fill="#1a1612" />)}
          </Group>
        );
      }

      case 'roundButton':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width/2} y={el.height/2} radius={el.width/2} fill={fillColor||'#3b82f6'} shadowColor="black" shadowBlur={6} shadowOpacity={0.3} />
            <Text x={0} y={el.height/2-6} width={el.width} text={el.text||'BTN'} fontSize={el.fontSize||12} fontStyle="bold" fill={normalizeColor(el.fontColor)||'#ffffff'} align="center" />
          </Group>
        );

      case 'pipe':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#94a3b8'} stroke={normalizeColor(el.stroke)||'#475569'} strokeWidth={el.strokeWidth||2} />
            <Line points={[0,el.height/2,el.width,el.height/2]} stroke="#475569" strokeWidth={1} dash={[8,4]} />
          </Group>
        );

      case 'conveyor':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor||'#475569'} stroke="#1e293b" strokeWidth={2} cornerRadius={4} />
            {[0.25,0.5,0.75].map((pos, i) => (<Line key={i} points={[el.width*pos,4,el.width*pos,el.height-4]} stroke="#94a3b8" strokeWidth={1} />))}
            <Text x={0} y={el.height+5} width={el.width} text="CONVEYOR" fontSize={10} fill="#1a1612" align="center" />
          </Group>
        );

      case 'svgSymbol':
        return <SvgSymbolElement key={el.id} el={el} commonProps={commonProps} />;

      case 'digitalClock': {
        const source = el.clockTimeSource || 'local';
        const currentTime = source === 'server' ? serverTime : localTime;
        const clockText = formatClockText(currentTime, el);
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={normalizeColor(el.clockBackgroundColor)||'#081B43'} cornerRadius={8} stroke={normalizeColor(el.clockAccentColor)||'#2563EB'} strokeWidth={1} />
            <Text x={0} y={el.height/2-10} width={el.width} text={clockText} fontSize={el.fontSize||18} fontStyle="bold" fill={normalizeColor(el.clockTextColor)||'#FFFFFF'} align="center" fontFamily="monospace" />
            {source==='server' && (<Text x={el.width-30} y={4} text="SRV" fontSize={7} fill={normalizeColor(el.clockAccentColor)||'#2563EB'} fontStyle="bold" />)}
          </Group>
        );
      }

      default: return null;
    }
  };

  const [overlay, setOverlay] = useState(null);
  const canvasContainerRef = useRef(null);

  const getElementScreenPos = (el) => {
    if (!canvasContainerRef.current) return { x: 0, y: 0 };
    const stageBox = canvasContainerRef.current.getBoundingClientRect();
    const parentBox = canvasContainerRef.current.parentElement.getBoundingClientRect();
    return { x: stageBox.left-parentBox.left+el.x, y: stageBox.top-parentBox.top+el.y };
  };

  const openIoFieldOverlay = (el) => {
    if (el.ioReadOnly) return;
    if (!el.ioTargetTag) { toast.warning('IoField has no target tag'); return; }
    const pos = getElementScreenPos(el);
    setOverlay({ type:'ioField', element:el, screenX:pos.x, screenY:pos.y, currentValue:liveValues[el.ioTargetTag] });
  };

  const openComboBoxOverlay = (el) => {
    if (!el.comboTargetTag) { toast.warning('ComboBox has no target tag'); return; }
    const pos = getElementScreenPos(el);
    setOverlay({ type:'comboBox', element:el, screenX:pos.x, screenY:pos.y, currentValue:liveValues[el.comboTargetTag] });
  };

  const handleOverlaySave = async (value) => {
    if (!overlay) return;
    const el = overlay.element;
    const isIoField = overlay.type==='ioField';
    const targetTag = isIoField ? el.ioTargetTag : el.comboTargetTag;
    const requireConfirm = isIoField ? !!el.ioRequireConfirm : !!el.comboRequireConfirm;
    setOverlay(null);
    await writeInteractiveValue({ targetTag, value, tags, requireConfirm, confirmMessage:`Set ${targetTag} to "${value}"?`, showToast:(msg,type)=>toast.showToast(msg,type) });
  };

  // ✅ Get all process picture elements for HTML overlay rendering
  const processPictureElements = elements.filter(el => isProcessPicture(el.type));

  return (
    <div
      className="w-full h-full overflow-auto flex items-center justify-center p-4"
      style={{ backgroundColor: '#0f172a', position: 'relative' }}
    >
      <div
        ref={canvasContainerRef}
        className="shadow-2xl border border-slate-700"
        style={{ width, height, position: 'relative' }}
      >
        {/* Konva Stage — renders normal elements */}
        <Stage
          width={width}
          height={height}
          style={{
            background: normalizeColor(backgroundColor) || '#ffffff',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <Layer>
            {elements.map((el) => renderElement(el, { openIoFieldOverlay, openComboBoxOverlay }))}
          </Layer>
        </Stage>

        {/* ═══════════════════════════════════════════════════════
            ✅ PROCESS PICTURE HTML OVERLAYS
            Rendered INSIDE canvas container so they inherit the same
            coordinate system as Konva elements. Uses explicit px dims
            so Recharts' ResponsiveContainer can measure them correctly.
            ═══════════════════════════════════════════════════════ */}
        {processPictureElements.map(el => {
          const w = Math.max(50, Number(el.width) || 400);
          const h = Math.max(50, Number(el.height) || 300);
          const isElVisible = el.isVisible !== false && el.isVisible !== 'No';
          if (!isElVisible) return null;

          return (
            <div
              key={`rt-overlay-${el.id}`}
              style={{
                position: 'absolute',
                left:   `${el.x}px`,
                top:    `${el.y}px`,
                width:  `${w}px`,
                height: `${h}px`,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : 'none',
                transformOrigin: 'top left',
                opacity: el.opacity ?? 1,
                pointerEvents: 'auto',
                overflow: 'hidden',
                borderRadius: '4px',
                zIndex: 10,
                background: '#FFFFFF', // fallback background so it's always visible
              }}
            >
              <ProcessPictureWidget
                element={el}
                liveValues={liveValues}
                tags={tags}
                isDesignMode={false}
              />
            </div>
          );
        })}

        <InteractiveOverlay
          overlay={overlay}
          tags={tags}
          onSave={handleOverlaySave}
          onCancel={() => setOverlay(null)}
        />
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────

function normalizeColor(color) {
  if (!color || typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return '#'+trimmed[1]+trimmed[1]+trimmed[2]+trimmed[2]+trimmed[3]+trimmed[3];
  return trimmed;
}

function interpolateColor(color1, color2, ratio) {
  const c1 = normalizeColor(color1); const c2 = normalizeColor(color2);
  if (!c1||!c2||!c1.startsWith('#')||!c2.startsWith('#')) return c1;
  const hex = (c) => parseInt(c.slice(1),16);
  const v1=hex(c1); const v2=hex(c2);
  const r=Math.round(((v1>>16)&0xff)+((((v2>>16)&0xff)-((v1>>16)&0xff))*ratio));
  const g=Math.round(((v1>>8)&0xff)+((((v2>>8)&0xff)-((v1>>8)&0xff))*ratio));
  const b=Math.round((v1&0xff)+(((v2&0xff)-(v1&0xff))*ratio));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`;
}

function hexToRgbNormalized(hex) {
  if (typeof hex!=='string'||!hex) return {r:1,g:1,b:1};
  const normalized = normalizeColor(hex);
  if (!normalized||typeof normalized!=='string'||!normalized.startsWith('#')) return {r:1,g:1,b:1};
  const clean = normalized.slice(1);
  if (clean.length!==6) return {r:1,g:1,b:1};
  return { r:parseInt(clean.slice(0,2),16)/255, g:parseInt(clean.slice(2,4),16)/255, b:parseInt(clean.slice(4,6),16)/255 };
}

const SvgSymbolElement = ({ el, commonProps }) => {
  const [image, status] = useImage(el.svgPath);
  const imageRef = useRef(null);
  const tintStrength = Math.max(0, Math.min(1, el.symbolTintStrength ?? 0));
  const brightness = el.symbolBrightness ?? 1;
  let tintColor = '#3b82f6';
  if (typeof el.symbolTint==='string'&&el.symbolTint.startsWith('#')) tintColor=el.symbolTint;
  else if (el.symbolTint===true) tintColor='#10b981';
  else if (el.symbolTint===false) tintColor='#ef4444';

  useEffect(() => {
    if (!imageRef.current||!image) return;
    const node = imageRef.current;
    node.cache();
    const filters = [];
    if (tintStrength>0) filters.push(Konva.Filters.RGB);
    if (brightness!==1) filters.push(Konva.Filters.Brighten);
    node.filters(filters);
    if (tintStrength>0) {
      const {r,g,b} = hexToRgbNormalized(tintColor);
      node.red(Math.round(255*(r*tintStrength+(1-tintStrength))));
      node.green(Math.round(255*(g*tintStrength+(1-tintStrength))));
      node.blue(Math.round(255*(b*tintStrength+(1-tintStrength))));
    } else { node.red(255); node.green(255); node.blue(255); }
    if (brightness!==1) node.brightness(brightness-1); else node.brightness(0);
    node.getLayer()?.batchDraw();
  }, [image,tintStrength,brightness,tintColor]);

  if (status==='loading') return (<Group {...commonProps}><Rect width={el.width} height={el.height} fill="#f0ece4" stroke="#c9a876" strokeWidth={1} dash={[4,4]} /><Text x={0} y={el.height/2-6} width={el.width} text="Loading..." fontSize={11} fill="#7a6f60" align="center" /></Group>);
  if (status==='error'||!image) return (<Group {...commonProps}><Rect width={el.width} height={el.height} fill="#fee2e2" stroke="#dc2626" strokeWidth={1} dash={[4,4]} /><Text x={0} y={el.height/2-6} width={el.width} text="SVG not found" fontSize={10} fill="#dc2626" align="center" /></Group>);
  return <KonvaImage {...commonProps} ref={imageRef} image={image} width={el.width} height={el.height} />;
};

function formatClockText(date, el) {
  const showSeconds = el.clockShowSeconds !== false;
  const is12h = el.clockTimeFormat === '12h';
  const displayMode = el.clockDisplayMode || 'timeAndDate';
  const dateFormat = el.clockDateFormat || 'DD/MM/YYYY';
  let hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2,'0');
  const secs = String(date.getSeconds()).padStart(2,'0');
  let ampm = '';
  if (is12h) { ampm = hours>=12?' PM':' AM'; hours=hours%12; if (hours===0) hours=12; }
  const hh = String(hours).padStart(2,'0');
  const timeStr = showSeconds ? `${hh}:${mins}:${secs}${ampm}` : `${hh}:${mins}${ampm}`;
  const day=String(date.getDate()).padStart(2,'0'); const month=String(date.getMonth()+1).padStart(2,'0'); const year=date.getFullYear();
  const monthNamesLong=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthNamesShort=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekdayLong=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
  let dateStr='';
  switch(dateFormat) {
    case 'DD/MM/YYYY': dateStr=`${day}/${month}/${year}`; break;
    case 'MM/DD/YYYY': dateStr=`${month}/${day}/${year}`; break;
    case 'YYYY-MM-DD': dateStr=`${year}-${month}-${day}`; break;
    case 'Long':      dateStr=`${monthNamesLong[date.getMonth()]} ${day}, ${year}`; break;
    case 'Short':     dateStr=`${monthNamesShort[date.getMonth()]} ${day}, ${year}`; break;
    default:          dateStr=`${day}/${month}/${year}`;
  }
  let tzStr='';
  if (el.clockShowTimezone) { try { const m=date.toString().match(/\(([^)]+)\)/); tzStr=m?` ${m[1].split(' ').map(w=>w[0]).join('')}`:''; } catch {} }
  switch(displayMode) {
    case 'timeOnly':   return timeStr+tzStr;
    case 'dateOnly':   return dateStr;
    case 'longFormat': return `${timeStr}${tzStr}  ·  ${weekdayLong}, ${dateStr}`;
    default:           return `${timeStr}${tzStr}  ·  ${dateStr}`;
  }
}

export default RuntimeCanvas;