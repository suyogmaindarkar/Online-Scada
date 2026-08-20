const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  username: { type: String, required: true, trim: true, minlength: 3 },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  fullName: { type: String, default: '' },
  role: {
    type: String,
    enum: ['admin', 'engineer', 'operator', 'viewer'],
    default: 'operator',
  },
  permissions: {
    canDesign: { type: Boolean, default: false },
    canManageTags: { type: Boolean, default: false },
    canControlPLC: { type: Boolean, default: false },
    canViewRuntime: { type: Boolean, default: true },
    canManageUsers: { type: Boolean, default: false },
  },
  avatarColor: { type: String, default: '#2563EB' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.index({ companyId: 1, username: 1 }, { unique: true });
userSchema.index({ companyId: 1, email: 1 }, { unique: true });

// Auto-assign permissions based on role (async — no next)
userSchema.pre('save', async function () {
  if (this.isModified('role')) {
    const rolePerms = {
      admin: { canDesign: true, canManageTags: true, canControlPLC: true, canViewRuntime: true, canManageUsers: true },
      engineer: { canDesign: true, canManageTags: true, canControlPLC: true, canViewRuntime: true, canManageUsers: false },
      operator: { canDesign: false, canManageTags: false, canControlPLC: true, canViewRuntime: true, canManageUsers: false },
      viewer: { canDesign: false, canManageTags: false, canControlPLC: false, canViewRuntime: true, canManageUsers: false },
    };
    this.permissions = rolePerms[this.role] || rolePerms.operator;
  }
});

// Hash password before saving (async — no next)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);