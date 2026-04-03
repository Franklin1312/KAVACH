const Policy = require('../models/Policy');

async function ensurePolicyMarkedPaidForDevelopment(policy) {
  if (!policy) return policy;
  if (process.env.NODE_ENV !== 'development') return policy;
  if (policy.premiumPaid) return policy;

  policy.premiumPaid = true;
  await policy.save();
  return policy;
}

async function findActivePolicyForWorker(workerId, now = new Date()) {
  const policy = await Policy.findOne({
    worker: workerId,
    status: 'active',
    weekStart: { $lte: now },
    weekEnd: { $gte: now },
  });

  return ensurePolicyMarkedPaidForDevelopment(policy);
}

module.exports = {
  ensurePolicyMarkedPaidForDevelopment,
  findActivePolicyForWorker,
};
