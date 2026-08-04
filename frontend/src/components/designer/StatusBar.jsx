import { MousePointer2, ZoomIn, Maximize2, Layers, Wifi, WifiOff, RotateCw } from 'lucide-react';

const StatusBar = ({
  mousePosition = { x: 0, y: 0 },
  zoom = 100,
  canvasWidth = 1200,
  canvasHeight = 700,
  elementCount = 0,
  selectedElement = null,
  connected = false,
  showGrid = false,
  rotationAngle = null,
}) => {
  return (
    <div
      style={{
        height: '24px',
        background: '#F8FAFC',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '12px',
        fontSize: '10px',
        color: '#334155',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Mouse Position */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Mouse position on canvas">
        <MousePointer2 size={10} style={{ color: '#5F6B7A' }} />
        <span style={{ fontFamily: 'monospace' }}>
          X: {mousePosition.x.toFixed(0)}, Y: {mousePosition.y.toFixed(0)}
        </span>
      </div>

      <Divider />

      {/* Canvas Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Canvas dimensions">
        <Maximize2 size={10} style={{ color: '#5F6B7A' }} />
        <span style={{ fontFamily: 'monospace' }}>
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      <Divider />

      {/* Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Current zoom level">
        <ZoomIn size={10} style={{ color: '#5F6B7A' }} />
        <span style={{ fontFamily: 'monospace' }}>{zoom}%</span>
      </div>

      <Divider />

      {/* Element Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Total elements on canvas">
        <Layers size={10} style={{ color: '#5F6B7A' }} />
        <span>
          {elementCount} object{elementCount !== 1 ? 's' : ''}
        </span>
      </div>

      {selectedElement && (
        <>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#2563EB' }}>●</span>
            <span>
              Selected: <span style={{ fontFamily: 'monospace', color: '#081B43' }}>{selectedElement.type}</span>
              {' '}
              <span style={{ color: '#5F6B7A' }}>
                ({selectedElement.width}×{selectedElement.height} @ {selectedElement.x},{selectedElement.y})
              </span>
            </span>
          </div>
        </>
      )}

      {/* Rotation Angle Indicator */}
      {rotationAngle !== null && rotationAngle !== undefined && (
        <>
          <Divider />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: '#EEF6FF',
              color: '#2563EB',
              fontWeight: 600,
            }}
            title="Rotation angle"
          >
            <RotateCw size={10} />
            <span style={{ fontFamily: 'monospace' }}>
              ∠ {Number(rotationAngle).toFixed(1)}°
            </span>
          </div>
        </>
      )}

      {/* Push right */}
      <div style={{ flex: 1 }} />

      {/* Grid Indicator */}
      {showGrid && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#5F6B7A' }} title="Grid visible">
            <span>▦</span>
            <span>Grid ON</span>
          </div>
          <Divider />
        </>
      )}

      {/* Connection Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          color: connected ? '#15803D' : '#B91C1C',
          background: connected ? '#DCFCE7' : '#FEE2E2',
          fontWeight: 600,
        }}
        title={connected ? 'Connected to server' : 'Disconnected from server'}
      >
        {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
        <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      <span style={{ color: '#5F6B7A' }}>Ready</span>
    </div>
  );
};

const Divider = () => (
  <div style={{ width: '1px', height: '12px', background: '#CBD5E1' }} />
);

export default StatusBar;