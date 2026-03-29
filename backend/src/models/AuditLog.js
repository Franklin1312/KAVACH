const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
    event:  { type: String, required: true },
    meta:   { type: mongoose.Schema.Types.Mixed },
    ip:     String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
