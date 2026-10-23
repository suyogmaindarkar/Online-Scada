// Persistence seams for SVG library elements.
// Keep these transformations shallow so arbitrary element fields and nested
// dynamic bindings survive save/reload without being rewritten or discarded.

export const createLibraryElement = (component, { id, x, y } = {}) => {
  if (!component?.template) return null;

  return {
    ...component.template,
    ...(id !== undefined ? { id } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
  };
};

const serializeValue = (value, seen) => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return 0;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((entry) => serializeValue(entry, seen));
    seen.delete(value);
    return result.filter((entry) => entry !== undefined);
  }

  const result = {};
  Object.entries(value).forEach(([key, entry]) => {
    const serialized = serializeValue(entry, seen);
    if (serialized !== undefined) result[key] = serialized;
  });
  seen.delete(value);
  return result;
};

export const serializeScreenElements = (elements) => (
  Array.isArray(elements)
    ? elements.map((element) => serializeValue(element, new WeakSet())).filter(Boolean)
    : []
);

export const serializeDirectConnections = (connections) => (
  Array.isArray(connections)
    ? connections.map((connection) => serializeValue(connection, new WeakSet())).filter(Boolean)
    : []
);

export const restoreScreenElements = (elements) => (
  Array.isArray(elements) ? elements.filter(Boolean).map((element) => ({ ...element })) : []
);
