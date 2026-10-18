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

export const serializeScreenElements = (elements) => (
  Array.isArray(elements) ? elements.map((element) => ({ ...element })) : []
);

export const restoreScreenElements = (elements) => (
  Array.isArray(elements) ? elements.filter(Boolean).map((element) => ({ ...element })) : []
);
