// ═══════════════════════════════════════════════════════════
// Tenant Context Middleware
//
// Enforces multi-tenancy at controller level.
// Provides helper to inject companyId into queries automatically.
// ═══════════════════════════════════════════════════════════

/**
 * Wraps Mongoose model methods to auto-inject companyId
 * Use in controllers: const CompanyTag = tenantScope(Tag, req.companyId);
 *                     const tags = await CompanyTag.find({ isActive: true });
 *
 * OR just manually add companyId to every query:
 *   Tag.find({ companyId: req.companyId, isActive: true });
 *
 * For safety, ALL controllers must include req.companyId in queries.
 */
const tenantScope = (Model, companyId) => {
  if (!companyId) {
    throw new Error(`tenantScope: companyId is required for ${Model.modelName}`);
  }
  return {
    find: (filter = {}) => Model.find({ ...filter, companyId }),
    findOne: (filter = {}) => Model.findOne({ ...filter, companyId }),
    findById: (id) => Model.findOne({ _id: id, companyId }),
    create: (data) => Model.create({ ...data, companyId }),
    updateOne: (filter, update, opts) =>
      Model.updateOne({ ...filter, companyId }, update, opts),
    updateMany: (filter, update, opts) =>
      Model.updateMany({ ...filter, companyId }, update, opts),
    findOneAndUpdate: (filter, update, opts) =>
      Model.findOneAndUpdate({ ...filter, companyId }, update, opts),
    findByIdAndUpdate: (id, update, opts) =>
      Model.findOneAndUpdate({ _id: id, companyId }, update, opts),
    findByIdAndDelete: (id) =>
      Model.findOneAndDelete({ _id: id, companyId }),
    deleteOne: (filter) => Model.deleteOne({ ...filter, companyId }),
    deleteMany: (filter) => Model.deleteMany({ ...filter, companyId }),
    countDocuments: (filter = {}) => Model.countDocuments({ ...filter, companyId }),
  };
};

/**
 * Middleware to validate that req.companyId exists.
 * Attach after userProtect for extra safety.
 */
const requireTenantContext = (req, res, next) => {
  if (!req.companyId) {
    return res.status(500).json({
      success: false,
      message: 'Tenant context missing — auth middleware not applied?',
      code: 'NO_TENANT_CONTEXT',
    });
  }
  next();
};

module.exports = {
  tenantScope,
  requireTenantContext,
};