import { Star, Layers } from 'lucide-react';
import { hasElementSpecificProperties, getElementLabel } from '../../config/elementProperties';
import COLORS from '../../theme/colors';

const PropertyTree = ({ elementType, activeCategory, onCategoryChange, multiSelectCount = 0 }) => {
  // ✅ Multi-select mode
  if (multiSelectCount > 0) {
    return (
      <div
        className="w-48 h-full flex flex-col items-center justify-center px-3"
        style={{
          background: '#FFFFFF',
          borderRight: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <Layers size={32} style={{ color: COLORS.brandAccent, marginBottom: '8px' }} />
        <p className="text-[13px] font-bold text-center mb-1" style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}>
          {multiSelectCount} Objects
        </p>
        <p className="text-[11px] text-center" style={{ color: COLORS.inkMuted }}>
          Select common properties on the right to edit all at once.
        </p>
      </div>
    );
  }

  if (!elementType) {
    return (
      <div
        className="w-48 h-full flex items-center justify-center"
        style={{
          background: '#FFFFFF',
          borderRight: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <p
          className="text-[11px] italic px-4 text-center"
          style={{ color: COLORS.inkSubtle }}
        >
          Select an element to view properties
        </p>
      </div>
    );
  }

  const getCategories = (type) => {
    const base = [];

    if (hasElementSpecificProperties(type)) {
      base.push({
        id: 'elementSpecific',
        label: `${getElementLabel(type)} Properties`,
        icon: Star,
        highlighted: true,
      });
    }

    base.push(
      { id: 'geometry', label: 'Geometry' },
      { id: 'colors', label: 'Colors' },
    );

    if (['text', 'textDisplay', 'button', 'numericDisplay', 'ioField', 'roundButton'].includes(type)) {
      base.push({ id: 'text', label: 'Text' });
    }

    base.push(
      { id: 'styles', label: 'Styles' },
      { id: 'miscellaneous', label: 'Miscellaneous' },
      { id: 'effects', label: 'Effects' },
    );

    if (['button', 'roundButton', 'checkBox', 'radioButton'].includes(type)) {
      base.push({ id: 'actions', label: 'Control Properties' });
    }

    return base;
  };

  const categories = getCategories(elementType);

  return (
    <div
      className="w-48 h-full overflow-y-auto select-none"
      style={{
        background: '#FFFFFF',
        borderRight: `1px solid ${COLORS.lineDefault}`,
      }}
    >
      <div
        className="px-3 py-2"
        style={{
          background: '#F8FAFC',
          borderBottom: `1px solid ${COLORS.lineDefault}`,
        }}
      >
        <p
          className="text-[11px] font-bold"
          style={{ color: COLORS.heading, fontFamily: COLORS.fonts.heading }}
        >
          {getElementLabel(elementType)}
        </p>
      </div>

      <div className="py-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] transition-colors"
              style={{
                background: isActive ? COLORS.brandAccent : 'transparent',
                color: isActive ? '#FFFFFF' : cat.highlighted ? COLORS.brandAccent : COLORS.heading,
                fontWeight: isActive || cat.highlighted ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = COLORS.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="text-[10px]" style={{ color: isActive ? '#FFFFFF' : COLORS.inkSubtle }}>├──</span>
              {Icon && (
                <Icon
                  size={11}
                  style={{ color: isActive ? '#FFFFFF' : COLORS.brandAccent }}
                  fill={isActive || cat.highlighted ? 'currentColor' : 'none'}
                />
              )}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyTree;
