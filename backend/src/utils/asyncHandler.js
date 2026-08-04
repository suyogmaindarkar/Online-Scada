// ═══════════════════════════════════════════════════════════
// asyncHandler — Wraps async controllers to auto-catch errors
// Usage: router.get('/', asyncHandler(myController))
// No more try/catch in every controller!
// ═══════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;