// Runtime content policy: the canvas is a projection of persisted user content.

export const getRuntimeElements = (screen) => (
  Array.isArray(screen?.elements) ? screen.elements : []
);

export const getAuthoredOptions = (options) => (
  Array.isArray(options) ? options.filter((option) => option && option.label !== undefined) : []
);
