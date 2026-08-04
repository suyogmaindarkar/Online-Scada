import { Stage, Layer, Rect, Circle, Line, Text, Group, RegularPolygon, Ellipse, Arc, Path, Transformer } from 'react-konva';
import { useRef, useEffect, useState } from 'react';
import Konva from 'konva';
import { tagAPI } from '../../services/api';
import { resolveElementBindings } from '../../utils/bindingUtils';
import { snap, snapPoint, snapSize, isBypassSnapKey } from '../../utils/snapUtils';
import { Image as KonvaImage } from 'react-konva';
import useImage from '../../hooks/useImage';

const DesignCanvas = ({
  elements,
  selectedId,
  onSelect,
  onUpdate,
  width,
  height,
  backgroundColor,
  liveValues = {},
  onMouseMove,
  onRotate,
  snapEnabled = false,
  gridSize = 10,
}) => {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const elementRefs = useRef({});
  const [flashState, setFlashState] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFlashState((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!transformerRef.current) return;

    if (selectedId && elementRefs.current[selectedId]) {
      transformerRef.current.nodes([elementRefs.current[selectedId]]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, elements]);

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (pos && onMouseMove) {
      onMouseMove({ x: pos.x, y: pos.y });
    }
  };

  const handleDragEnd = (e, id) => {
    const bypass = isBypassSnapKey(e.evt);
    const shouldSnap = snapEnabled && !bypass;

    let newX = e.target.x();
    let newY = e.target.y();

    if (shouldSnap) {
      const snapped = snapPoint(newX, newY, gridSize);
      newX = snapped.x;
      newY = snapped.y;
      e.target.x(newX);
      e.target.y(newY);
    }

    onUpdate(id, { x: newX, y: newY });
  };

  const handleTransformEnd = (e, el) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    let newWidth = Math.max(5, (el.width || 100) * scaleX);
    let newHeight = Math.max(5, (el.height || 100) * scaleY);
    let newX = node.x();
    let newY = node.y();
    const newRotation = node.rotation();

    const bypass = isBypassSnapKey(e.evt);
    const shouldSnap = snapEnabled && !bypass;

    if (shouldSnap) {
      const snappedPos = snapPoint(newX, newY, gridSize);
      const snappedSz = snapSize(newWidth, newHeight, gridSize, 5);
      newX = snappedPos.x;
      newY = snappedPos.y;
      newWidth = snappedSz.width;
      newHeight = snappedSz.height;
      node.x(newX);
      node.y(newY);
    }

    onUpdate(el.id, {
      x: newX,
      y: newY,
      width: Math.round(newWidth),
      height: Math.round(newHeight),
      rotation: Math.round(newRotation * 100) / 100,
    });
  };

  const handleTransform = (e) => {
    if (onRotate) {
      onRotate(Math.round(e.target.rotation() * 100) / 100);
    }
  };

  const renderElement = (originalEl) => {
    const el = originalEl;
    const isSelected = el.id === selectedId;
    const liveValue = null;

    let fillColor = normalizeColor(el.fill);
    let isVisible = true;

    if (el.boundTag && liveValue !== null && liveValue !== undefined) {
      if (el.animation?.enabled && el.animation?.type === 'color') {
        if (typeof liveValue === 'boolean') {
          fillColor = liveValue
            ? normalizeColor(el.animation.maxColor) || '#10b981'
            : normalizeColor(el.animation.minColor) || '#ef4444';
        } else if (typeof liveValue === 'number') {
          const min = parseFloat(el.animation.minValue) || 0;
          const max = parseFloat(el.animation.maxValue) || 100;
          if (liveValue >= max) {
            fillColor = normalizeColor(el.animation.maxColor) || '#10b981';
          } else if (liveValue <= min) {
            fillColor = normalizeColor(el.animation.minColor) || '#ef4444';
          } else {
            const ratio = (liveValue - min) / (max - min);
            fillColor = interpolateColor(
              normalizeColor(el.animation.minColor) || '#ef4444',
              normalizeColor(el.animation.maxColor) || '#10b981',
              ratio
            );
          }
        }
      }

      if (el.animation?.enabled && el.animation?.type === 'flash') {
        let shouldFlash = false;
        if (typeof liveValue === 'boolean') {
          shouldFlash = liveValue === true;
        } else if (typeof liveValue === 'number') {
          const threshold = parseFloat(el.animation.flashThreshold) || 80;
          shouldFlash = liveValue >= threshold;
        }
        if (shouldFlash) {
          fillColor = flashState
            ? normalizeColor(el.animation.flashColor1) || '#ef4444'
            : normalizeColor(el.animation.flashColor2) || '#fbbf24';
        }
      }

      if (el.animation?.enabled && el.animation?.type === 'visibility') {
        if (typeof liveValue === 'boolean') {
          isVisible = liveValue;
        } else if (typeof liveValue === 'number') {
          const min = parseFloat(el.animation.minValue) || 0;
          isVisible = liveValue >= min;
        }
      }
    }

    if (!isVisible) return null;

    const handleElementClick = async (e) => {
      e.cancelBubble = true;
      onSelect(el.id);
      if (el.type === 'button' && el.action?.targetTag) {
        try {
          let value = el.action.targetValue;
          if (value === undefined || value === '') {
            value = !liveValue;
          }
          await tagAPI.writeValue(el.action.targetTag, value);
          console.log(`✓ Button clicked: ${el.action.targetTag} = ${value}`);
        } catch (err) {
          console.error('Button action failed:', err);
        }
      }
    };

    const refCallback = (node) => {
      if (node) {
        elementRefs.current[el.id] = node;
      } else {
        delete elementRefs.current[el.id];
      }
    };

    const commonProps = {
      ref: refCallback,
      x: el.x,
      y: el.y,
      draggable: true,
      onClick: handleElementClick,
      onTap: handleElementClick,
      onDragEnd: (e) => handleDragEnd(e, el.id),
      onTransformEnd: (e) => handleTransformEnd(e, el),
      onTransform: handleTransform,
      stroke: normalizeColor(el.stroke),
      strokeWidth: el.strokeWidth || 1,
      opacity: el.opacity ?? 1,
      rotation: el.rotation || 0,
    };

    switch (el.type) {
      case 'rectangle':
        return (
          <Rect key={el.id} {...commonProps}
            width={el.width} height={el.height}
            fill={fillColor} cornerRadius={4} />
        );

      case 'circle':
        return (
          <Circle key={el.id} {...commonProps}
            radius={el.width / 2} fill={fillColor} />
        );

      case 'line':
        return (
          <Line key={el.id} {...commonProps}
            points={[0, 0, el.width, 0]}
            stroke={fillColor || normalizeColor(el.stroke)}
            strokeWidth={el.strokeWidth || 2} />
        );

      case 'text':
        return (
          <Text key={el.id} {...commonProps}
            text={el.text || 'Text'}
            fontSize={el.fontSize || 16}
            fill={normalizeColor(el.fontColor) || '#000000'}
            fontFamily="Arial" />
        );

      case 'tank': {
        const minLevel = el.tankMinLevel ?? 0;
        const maxLevel = el.tankMaxLevel ?? 100;
        const warningHigh = el.tankWarningHigh ?? 90;
        const warningLow = el.tankWarningLow ?? 10;
        const currentLevel = liveValue !== null && liveValue !== undefined
          ? Math.min(Math.max(Number(liveValue), minLevel), maxLevel) : 0;
        const fillRatio = maxLevel !== minLevel
          ? (currentLevel - minLevel) / (maxLevel - minLevel) : 0;

        let liquidColor = normalizeColor(el.tankLiquidColor) || '#06b6d4';
        if (currentLevel >= warningHigh) liquidColor = '#f59e0b';
        if (currentLevel >= warningHigh * 1.05) liquidColor = '#ef4444';
        if (currentLevel <= warningLow) liquidColor = '#fbbf24';

        const unit = el.tankUnit || '%';
        const showValue = el.tankShowPercentage !== false;

        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#1e293b"
              stroke="#475569" strokeWidth={3} cornerRadius={[10, 10, 0, 0]} />
            {liveValue !== null && liveValue !== undefined && (
              <Rect x={3} y={el.height * (1 - fillRatio)}
                width={el.width - 6} height={el.height * fillRatio}
                fill={liquidColor} />
            )}
            {el.tankShowScale && (
              <Line points={[0, el.height * (1 - (warningHigh - minLevel) / (maxLevel - minLevel)),
                el.width, el.height * (1 - (warningHigh - minLevel) / (maxLevel - minLevel))]}
                stroke="#f59e0b" strokeWidth={1} dash={[4, 2]} />
            )}
            {el.tankShowScale && (
              <Line points={[0, el.height * (1 - (warningLow - minLevel) / (maxLevel - minLevel)),
                el.width, el.height * (1 - (warningLow - minLevel) / (maxLevel - minLevel))]}
                stroke="#fbbf24" strokeWidth={1} dash={[4, 2]} />
            )}
            {showValue && (
              <Text x={0} y={el.height + 5} width={el.width}
                text={liveValue !== null && liveValue !== undefined
                  ? `${Number(liveValue).toFixed(1)} ${unit}` : `TANK`}
                fontSize={12} fill="#081B43" align="center" fontStyle="bold" />
            )}
          </Group>
        );
      }

      case 'pump':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 2}
              fill={el.boundTag && liveValue !== null && liveValue !== undefined
                ? liveValue ? '#10b981' : '#ef4444' : fillColor}
              stroke="#1e293b" strokeWidth={3} />
            <Text x={0} y={el.height / 2 - 8} width={el.width} text="P"
              fontSize={24} fontStyle="bold" fill="#ffffff" align="center" />
            <Text x={0} y={el.height + 5} width={el.width} text="PUMP"
              fontSize={12} fill="#000000" align="center" />
          </Group>
        );

      case 'motor': {
        const isRunning = el.boundTag && liveValue;
        const motorColor = isRunning
          ? normalizeColor(el.motorRunningColor) || '#10b981'
          : normalizeColor(el.motorStoppedColor) || '#ef4444';
        const showLabel = el.motorShowLabel !== false;
        const labelText = el.motorLabelText || 'MOTOR';

        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={el.boundTag ? motorColor : fillColor}
              cornerRadius={8} shadowBlur={isRunning ? 12 : 0}
              shadowColor={motorColor} />
            <Text x={0} y={el.height / 2 - 14} width={el.width} text="M"
              fontSize={28} fontStyle="bold" fill="#ffffff" align="center" />
            {isRunning && el.motorRPM && (
              <Text x={0} y={el.height / 2 + 6} width={el.width}
                text={`${el.motorRPM} RPM`} fontSize={9} fill="#ffffff"
                align="center" fontFamily="monospace" />
            )}
            {showLabel && (
              <Text x={0} y={el.height + 5} width={el.width} text={labelText}
                fontSize={11} fill="#081B43" align="center" fontStyle="bold" />
            )}
          </Group>
        );
      }

      case 'valve': {
        const valveColor = el.boundTag && liveValue !== null && liveValue !== undefined
          ? liveValue ? '#10b981' : '#ef4444' : fillColor;
        return (
          <Group key={el.id} {...commonProps}>
            <RegularPolygon x={el.width / 2} y={el.height / 2}
              sides={3} radius={el.width / 2} fill={valveColor} rotation={90} />
            <RegularPolygon x={el.width / 2} y={el.height / 2}
              sides={3} radius={el.width / 2} fill={valveColor} rotation={270} />
            <Text x={0} y={el.height + 5} width={el.width} text="VALVE"
              fontSize={12} fill="#000000" align="center" />
          </Group>
        );
      }

      case 'indicator': {
        const indicatorActive = el.boundTag && liveValue !== null && liveValue !== undefined
          ? !!liveValue : false;
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 2}
              fill={indicatorActive ? '#10b981' : '#374151'}
              stroke="#1e293b" strokeWidth={2}
              shadowBlur={indicatorActive ? 15 : 0}
              shadowColor={indicatorActive ? '#10b981' : 'transparent'} />
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 3}
              fill={indicatorActive ? '#34d399' : '#475569'} />
          </Group>
        );
      }

      case 'gauge':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 2}
              fill="#1e293b" stroke="#475569" strokeWidth={3} />
            <Text x={0} y={el.height / 2 - 12} width={el.width}
              text={liveValue !== null && liveValue !== undefined
                ? Math.round(liveValue).toString() : '0'}
              fontSize={20} fontStyle="bold" fill="#2563EB" align="center" />
            <Text x={0} y={el.height / 2 + 8} width={el.width} text="GAUGE"
              fontSize={10} fill="#94a3b8" align="center" />
          </Group>
        );

      case 'numericDisplay': {
        let displayText = '0';
        if (liveValue !== null && liveValue !== undefined) {
          const num = Number(liveValue);
          const decimals = el.numDecimals ?? 2;
          if (el.numFormat === 'Integer') displayText = Math.round(num).toString();
          else if (el.numFormat === 'Scientific') displayText = num.toExponential(decimals);
          else if (el.numFormat === 'Percentage') displayText = (num * 100).toFixed(decimals) + '%';
          else displayText = num.toFixed(decimals);
          if (el.numThousandSep && el.numFormat !== 'Scientific') {
            const parts = displayText.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            displayText = parts.join('.');
          }
        }
        const fullText = `${el.numPrefix || ''}${displayText}${el.numSuffix || ''}`;
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#0f172a'} stroke="#2563EB"
              strokeWidth={2} cornerRadius={4} />
            <Text x={0} y={el.height / 2 - 12} width={el.width} text={fullText}
              fontSize={20} fontStyle="bold"
              fill={normalizeColor(el.fontColor) || '#2563EB'}
              align={el.numTextAlign || 'center'} fontFamily="monospace" />
          </Group>
        );
      }

      case 'textDisplay':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#0f172a"
              stroke="#475569" strokeWidth={1} cornerRadius={4} />
            <Text x={5} y={el.height / 2 - 8} width={el.width - 10}
              text={liveValue !== null && liveValue !== undefined
                ? String(liveValue) : el.text || 'Text'}
              fontSize={14} fill="#ffffff" align="left" />
          </Group>
        );

      case 'button': {
        const buttonIcon = el.buttonIcon || 'None';
        const iconPaths = {
          Play:   'M8 5v14l11-7z',
          Stop:   'M6 6h12v12H6z',
          Reset:  'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
          Save:   'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
          Delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
          Edit:   'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
          Power:  'M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z',
          Alert:  'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
        };
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill={fillColor || '#2563EB'}
              cornerRadius={6} shadowColor="black" shadowBlur={5}
              shadowOpacity={0.3} shadowOffsetY={2} />
            {buttonIcon !== 'None' && iconPaths[buttonIcon] && (
              <Path x={el.text ? el.width / 2 - 40 : el.width / 2 - 10}
                y={el.height / 2 - 10} data={iconPaths[buttonIcon]}
                fill={normalizeColor(el.fontColor) || '#ffffff'}
                scale={{ x: 0.83, y: 0.83 }} />
            )}
            <Text x={buttonIcon !== 'None' && iconPaths[buttonIcon] ? 20 : 0}
              y={el.height / 2 - 8}
              width={buttonIcon !== 'None' && iconPaths[buttonIcon] ? el.width - 20 : el.width}
              text={el.text || 'BUTTON'} fontSize={el.fontSize || 14}
              fontStyle="bold" fill={normalizeColor(el.fontColor) || '#ffffff'}
              align="center" />
            {el.buttonType && el.buttonType !== 'Momentary' && (
              <Text x={el.width - 30} y={4}
                text={el.buttonType === 'Toggle' ? '⇄' : el.buttonType === 'SetOnce' ? '1' : 'R'}
                fontSize={9} fill={normalizeColor(el.fontColor) || '#ffffff'}
                opacity={0.7} />
            )}
          </Group>
        );
      }

      case 'ellipse':
        return (
          <Ellipse key={el.id} {...commonProps}
            radiusX={el.width / 2} radiusY={el.height / 2}
            offsetX={-el.width / 2} offsetY={-el.height / 2}
            fill={fillColor} />
        );

      case 'polygon':
        return (
          <RegularPolygon key={el.id} {...commonProps}
            sides={el.sides || 5} radius={el.width / 2}
            offsetX={-el.width / 2} offsetY={-el.height / 2}
            fill={fillColor} />
        );

      case 'polyline':
        return (
          <Line key={el.id} {...commonProps}
            points={[0, 0, el.width / 2, el.height, el.width, 0]}
            stroke={fillColor || normalizeColor(el.stroke)}
            strokeWidth={el.strokeWidth || 2} closed={false} />
        );

      case 'ellipseArc':
      case 'circularArc':
        return (
          <Arc key={el.id} {...commonProps}
            innerRadius={0} outerRadius={el.width / 2} angle={270}
            offsetX={-el.width / 2} offsetY={-el.height / 2}
            fill={fillColor} />
        );

      case 'roundedRectangle':
        return (
          <Rect key={el.id} {...commonProps}
            width={el.width} height={el.height} fill={fillColor}
            cornerRadius={el.cornerRadius || 16} />
        );

      case 'connector':
        return (
          <Line key={el.id} {...commonProps}
            points={[0, 0, el.width, 0]}
            stroke={normalizeColor(el.stroke) || '#5F6B7A'}
            strokeWidth={el.strokeWidth || 2} dash={[4, 4]} />
        );

      case 'ioField': {
        let displayText = '0';
        if (liveValue !== null && liveValue !== undefined) {
          const num = Number(liveValue);
          const decimals = el.ioDecimals ?? 2;
          if (el.ioFormat === 'Integer') displayText = Math.round(num).toString();
          else if (el.ioFormat === 'Hex') displayText = '0x' + Math.round(num).toString(16).toUpperCase();
          else if (el.ioFormat === 'Binary') displayText = Math.round(num).toString(2);
          else if (el.ioFormat === 'Boolean') displayText = liveValue ? 'TRUE' : 'FALSE';
          else if (el.ioFormat === 'String') displayText = String(liveValue);
          else displayText = num.toFixed(decimals);
        }
        const fullText = `${el.ioPrefix || ''}${displayText}${el.ioSuffix || ''}`;
        const align = el.ioTextAlign || 'right';
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#F8FAFC'}
              stroke={normalizeColor(el.stroke) || '#2563EB'}
              strokeWidth={el.ioReadOnly ? 1 : 2} cornerRadius={2} />
            <Text x={4} y={el.height / 2 - 6} width={el.width - 8} text={fullText}
              fontSize={el.fontSize || 14}
              fill={normalizeColor(el.fontColor) || '#081B43'}
              fontFamily="monospace" align={align}
              fontStyle={el.ioReadOnly ? 'normal' : 'bold'} />
          </Group>
        );
      }

      case 'bar': {
        const min = el.barMin ?? 0;
        const max = el.barMax ?? 100;
        const warningHigh = el.barWarningHigh ?? 80;
        const warningLow = el.barWarningLow ?? 20;
        const current = liveValue !== null && liveValue !== undefined
          ? Math.min(Math.max(Number(liveValue), min), max)
          : (min + max) / 2;
        const ratio = max !== min ? (current - min) / (max - min) : 0.5;

        let barColor = normalizeColor(el.barNormalColor) || '#10b981';
        if (current >= warningHigh || current <= warningLow) {
          barColor = normalizeColor(el.barWarningColor) || '#f59e0b';
        }
        if (current >= max * 0.95 || current <= min * 1.05) {
          barColor = normalizeColor(el.barCriticalColor) || '#ef4444';
        }

        const orientation = el.barOrientation || 'Vertical';
        const isVertical = orientation === 'Vertical';
        const showValue = el.barShowValue !== false;

        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill="#F8FAFC" stroke="#2563EB" strokeWidth={1} cornerRadius={2} />
            {isVertical ? (
              <Rect x={2} y={el.height - (el.height - 4) * ratio}
                width={el.width - 4} height={(el.height - 4) * ratio}
                fill={barColor} />
            ) : (
              <Rect x={2} y={2} width={(el.width - 4) * ratio}
                height={el.height - 4} fill={barColor} />
            )}
            {showValue && (
              <Text x={0} y={el.height + 5} width={el.width}
                text={liveValue !== null && liveValue !== undefined
                  ? `${Number(liveValue).toFixed(1)}`
                  : `${((min + max) / 2).toFixed(1)}`}
                fontSize={11} fill="#081B43" align="center" fontStyle="bold" />
            )}
          </Group>
        );
      }

      case 'graphicObject':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#EEF6FF'} stroke="#2563EB"
              strokeWidth={1} dash={[6, 4]} />
            <Text x={0} y={el.height / 2 - 6} width={el.width}
              text="Graphic" fontSize={11} fill="#5F6B7A" align="center" />
          </Group>
        );

      case 'statusDisplay':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#0f172a'} stroke="#2563EB"
              strokeWidth={1} cornerRadius={2} />
            <Circle x={12} y={el.height / 2} radius={5}
              fill={liveValue ? '#10b981' : '#ef4444'} shadowBlur={8}
              shadowColor={liveValue ? '#10b981' : '#ef4444'} />
            <Text x={24} y={el.height / 2 - 6} width={el.width - 30}
              text={liveValue !== null && liveValue !== undefined
                ? liveValue ? 'ONLINE' : 'OFFLINE'
                : el.text || 'STATUS'}
              fontSize={12} fill={normalizeColor(el.fontColor) || '#10b981'}
              fontStyle="bold" fontFamily="monospace" />
          </Group>
        );

      case 'textList':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#ffffff'} stroke="#2563EB"
              strokeWidth={1} cornerRadius={2} />
            {['Item 1', 'Item 2', 'Item 3'].map((item, i) => (
              <Text key={i} x={6} y={6 + i * 18} width={el.width - 12}
                text={item} fontSize={11} fill="#081B43" />
            ))}
          </Group>
        );

      case 'comboBox':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#ffffff'}
              stroke={normalizeColor(el.stroke) || '#2563EB'}
              strokeWidth={1} cornerRadius={2} />
            <Text x={6} y={el.height / 2 - 6} width={el.width - 24}
              text={el.text || 'Select...'} fontSize={11} fill="#081B43" />
            <Line points={[
              el.width - 14, el.height / 2 - 3,
              el.width - 10, el.height / 2 + 3,
              el.width - 6, el.height / 2 - 3,
            ]} stroke="#5F6B7A" strokeWidth={1.5} />
          </Group>
        );

      case 'listBox':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#ffffff'}
              stroke={normalizeColor(el.stroke) || '#2563EB'}
              strokeWidth={1} cornerRadius={2} />
            {['Option A', 'Option B', 'Option C', 'Option D'].map((opt, i) => (
              <Text key={i} x={6} y={6 + i * 20} width={el.width - 12}
                text={opt} fontSize={11} fill="#081B43" />
            ))}
          </Group>
        );

      case 'checkBox':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height} fill="#ffffff"
              stroke={normalizeColor(el.stroke) || '#2563EB'}
              strokeWidth={2} cornerRadius={2} />
            {liveValue && (
              <Line points={[
                el.width * 0.2, el.height * 0.5,
                el.width * 0.45, el.height * 0.75,
                el.width * 0.8, el.height * 0.25,
              ]} stroke="#10b981" strokeWidth={3} lineCap="round" />
            )}
          </Group>
        );

      case 'radioButton':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 2}
              fill="#ffffff"
              stroke={normalizeColor(el.stroke) || '#2563EB'} strokeWidth={2} />
            {liveValue && (
              <Circle x={el.width / 2} y={el.height / 2}
                radius={el.width / 4} fill="#2563EB" />
            )}
          </Group>
        );

      case 'roundButton':
        return (
          <Group key={el.id} {...commonProps}>
            <Circle x={el.width / 2} y={el.height / 2} radius={el.width / 2}
              fill={fillColor || '#2563EB'} shadowColor="black"
              shadowBlur={6} shadowOpacity={0.3} />
            <Text x={0} y={el.height / 2 - 6} width={el.width}
              text={el.text || 'BTN'} fontSize={el.fontSize || 12}
              fontStyle="bold"
              fill={normalizeColor(el.fontColor) || '#ffffff'} align="center" />
          </Group>
        );

      case 'pipe':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#94a3b8'}
              stroke={normalizeColor(el.stroke) || '#475569'}
              strokeWidth={el.strokeWidth || 2} />
            <Line points={[0, el.height / 2, el.width, el.height / 2]}
              stroke="#475569" strokeWidth={1} dash={[8, 4]} />
          </Group>
        );

      case 'conveyor':
        return (
          <Group key={el.id} {...commonProps}>
            <Rect width={el.width} height={el.height}
              fill={fillColor || '#475569'} stroke="#1e293b"
              strokeWidth={2} cornerRadius={4} />
            {[0.25, 0.5, 0.75].map((pos, i) => (
              <Line key={i}
                points={[el.width * pos, 4, el.width * pos, el.height - 4]}
                stroke="#94a3b8" strokeWidth={1} />
            ))}
            <Text x={0} y={el.height + 5} width={el.width} text="CONVEYOR"
              fontSize={10} fill="#081B43" align="center" />
          </Group>
        );

      case 'svgSymbol': {
        return (
          <SvgSymbolElement
            key={el.id}
            el={el}
            commonProps={commonProps}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        backgroundColor: '#F1F5F9',  // ✅ Blue-gray canvas surround (was cream #ebe3d5)
      }}
    >
      <div
        style={{
          width: width,
          height: height,
          minWidth: width,
          minHeight: height,
          backgroundColor: normalizeColor(backgroundColor) || '#ffffff',
          backgroundImage: `
            linear-gradient(to right, rgba(15, 61, 145, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 61, 145, 0.05) 1px, transparent 1px),
            linear-gradient(to right, rgba(15, 61, 145, 0.10) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 61, 145, 0.10) 1px, transparent 1px)`,
          backgroundSize: '10px 10px, 10px 10px, 50px 50px, 50px 50px',
          backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
          border: '1px solid #CBD5E1',  // ✅ Clean gray border (was gold #c9a876)
          borderRadius: '4px',
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.08)',
        }}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseMove={handleMouseMove}
          style={{ background: 'transparent' }}
        >
          <Layer>
            {elements.map((el) => renderElement(el))}
            <Transformer
              ref={transformerRef}
              borderStroke="#2563EB"          // ✅ Brand blue (was #0078d4)
              borderStrokeWidth={1}
              borderDash={[4, 3]}
              anchorFill="#ffffff"
              anchorStroke="#2563EB"          // ✅ Brand blue
              anchorStrokeWidth={1.5}
              anchorSize={8}
              anchorCornerRadius={1}
              rotateEnabled={true}
              rotationSnaps={[]}
              rotateAnchorOffset={30}
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function normalizeColor(color) {
  if (!color || typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
  }
  return trimmed;
}

function interpolateColor(color1, color2, ratio) {
  const c1 = normalizeColor(color1);
  const c2 = normalizeColor(color2);
  if (!c1 || !c2 || !c1.startsWith('#') || !c2.startsWith('#')) return c1;
  const hex = (c) => parseInt(c.slice(1), 16);
  const v1 = hex(c1);
  const v2 = hex(c2);
  const r1 = (v1 >> 16) & 0xff;
  const g1 = (v1 >> 8) & 0xff;
  const b1 = v1 & 0xff;
  const r2 = (v2 >> 16) & 0xff;
  const g2 = (v2 >> 8) & 0xff;
  const b2 = v2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ═══════════════════════════════════════════════════════════
// SvgSymbolElement — Designer (no tint filters)
// ═══════════════════════════════════════════════════════════
const SvgSymbolElement = ({ el, commonProps }) => {
  const [image, status] = useImage(el.svgPath);

  if (status === 'loading') {
    return (
      <Group {...commonProps}>
        <Rect width={el.width} height={el.height}
          fill="#EEF6FF" stroke="#2563EB"
          strokeWidth={1} dash={[4, 4]} />
        <Text x={0} y={el.height / 2 - 6} width={el.width}
          text="Loading..." fontSize={11} fill="#5F6B7A" align="center" />
      </Group>
    );
  }

  if (status === 'error' || !image) {
    return (
      <Group {...commonProps}>
        <Rect width={el.width} height={el.height}
          fill="#FEE2E2" stroke="#DC2626"
          strokeWidth={1} dash={[4, 4]} />
        <Text x={0} y={el.height / 2 - 6} width={el.width}
          text="SVG not found" fontSize={10} fill="#DC2626" align="center" />
      </Group>
    );
  }

  return (
    <KonvaImage
      {...commonProps}
      image={image}
      width={el.width}
      height={el.height}
    />
  );
};

export default DesignCanvas;