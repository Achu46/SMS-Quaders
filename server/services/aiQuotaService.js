const AI_CONFIG = require('../config/aiConfig');
const defaultPrisma = require('../prismaClient');

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC (or local system time)
 */
function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Returns the timestamp when the daily limit resets (Midnight UTC of next day)
 */
function getNextResetIsoString() {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Resolves the subscription plan and corresponding daily AI limit for a school
 */
async function getSchoolPlanAndLimit(schoolId, prisma = defaultPrisma) {
  if (!schoolId) {
    return { plan: 'FREE', limit: AI_CONFIG.planLimits.FREE };
  }

  // Find school or school document for active plan
  let planName = 'FREE';

  try {
    // Check if there is a plan stored in SchoolDocument or school record
    const planDoc = await prisma.schoolDocument.findFirst({
      where: { schoolId, collection: 'settings' }
    });

    if (planDoc && planDoc.data && (planDoc.data.plan || planDoc.data.subscriptionPlan)) {
      planName = String(planDoc.data.plan || planDoc.data.subscriptionPlan).toUpperCase();
    } else {
      // Also check billing/plan collection
      const billingDoc = await prisma.schoolDocument.findFirst({
        where: { schoolId, collection: 'billing' }
      });
      if (billingDoc && billingDoc.data && billingDoc.data.plan) {
        planName = String(billingDoc.data.plan).toUpperCase();
      }
    }
  } catch (err) {
    console.error('Error fetching school plan:', err);
  }

  // Normalize plan names (e.g. ENTERPRISE_MONTHLY -> ENTERPRISE)
  let normalizedPlan = 'FREE';
  const cleanPlan = planName.replace(/[-_].*$/, '').toUpperCase();

  if (AI_CONFIG.planLimits[cleanPlan] !== undefined) {
    normalizedPlan = cleanPlan;
  } else if (AI_CONFIG.planLimits[planName] !== undefined) {
    normalizedPlan = planName;
  }

  const limit = AI_CONFIG.planLimits[normalizedPlan] !== undefined 
    ? AI_CONFIG.planLimits[normalizedPlan] 
    : AI_CONFIG.defaultLimit;

  return { plan: normalizedPlan, limit };
}

/**
 * Retrieves the current AI usage status for a school or user without consuming any quota
 */
async function getUsageStatus(schoolId, prisma = defaultPrisma, user = null) {
  const usageDate = getTodayDateString();

  // Super Admin has unlimited AI requests
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'superadmin' || user.role === 'super_admin')) {
    return {
      schoolId: schoolId || null,
      plan: 'SUPER_ADMIN',
      limit: 'Unlimited',
      usedToday: 0,
      remaining: 'Unlimited',
      isUnlimited: true,
      usageDate,
      resetTime: getNextResetIsoString(),
      allowed: true
    };
  }

  const { plan, limit } = await getSchoolPlanAndLimit(schoolId, prisma);

  if (!schoolId) {
    return {
      schoolId: null,
      plan: 'FREE',
      limit: 1,
      usedToday: 0,
      remaining: 1,
      isUnlimited: false,
      usageDate,
      resetTime: getNextResetIsoString(),
      allowed: true
    };
  }

  const usageRecord = await prisma.aiUsage.findUnique({
    where: {
      schoolId_usageDate: {
        schoolId,
        usageDate
      }
    }
  });

  const usedToday = usageRecord ? usageRecord.requestCount : 0;
  const remaining = Math.max(0, limit - usedToday);

  return {
    schoolId,
    plan,
    limit,
    usedToday,
    remaining,
    isUnlimited: false,
    usageDate,
    resetTime: getNextResetIsoString(),
    allowed: remaining > 0
  };
}

/**
 * Atomically checks whether a school has remaining daily quota and increments the counter.
 * Uses a transactional pattern to prevent race conditions from concurrent requests.
 * 
 * @returns {Promise<{ allowed: boolean, usage: object, reason?: string }>}
 */
async function checkAndReserveQuota(schoolId, prisma = defaultPrisma, user = null) {
  const usageDate = getTodayDateString();

  // 1. Super Admin bypass: Always Unlimited
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'superadmin' || user.role === 'super_admin')) {
    return {
      allowed: true,
      usage: {
        schoolId: schoolId || null,
        plan: 'SUPER_ADMIN',
        limit: 'Unlimited',
        usedToday: 0,
        remaining: 'Unlimited',
        isUnlimited: true,
        usageDate,
        resetTime: getNextResetIsoString()
      }
    };
  }

  if (!schoolId) {
    return {
      allowed: false,
      reason: 'No school/tenant context provided.',
      usage: null
    };
  }

  const { plan, limit } = await getSchoolPlanAndLimit(schoolId, prisma);

  // Execute atomic quota verification and increment inside an isolation-safe transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch or create today's usage row
      let usage = await tx.aiUsage.findUnique({
        where: {
          schoolId_usageDate: {
            schoolId,
            usageDate
          }
        }
      });

      if (!usage) {
        // First request of the day for this school
        usage = await tx.aiUsage.create({
          data: {
            schoolId,
            plan,
            usageDate,
            requestCount: 1
          }
        });

        return {
          allowed: true,
          usedToday: 1,
          remaining: Math.max(0, limit - 1),
          limit,
          plan,
          usageDate
        };
      }

      // 2. Check if quota exceeded
      if (usage.requestCount >= limit) {
        return {
          allowed: false,
          usedToday: usage.requestCount,
          remaining: 0,
          limit,
          plan,
          usageDate,
          reason: `Daily AI request limit reached (${usage.requestCount}/${limit} used for ${plan} plan). Quota resets at midnight UTC.`
        };
      }

      // 3. Atomically increment
      const updated = await tx.aiUsage.update({
        where: { id: usage.id },
        data: {
          requestCount: { increment: 1 },
          plan // Keep plan up-to-date
        }
      });

      return {
        allowed: true,
        usedToday: updated.requestCount,
        remaining: Math.max(0, limit - updated.requestCount),
        limit,
        plan,
        usageDate
      };
    });

    return {
      allowed: result.allowed,
      reason: result.reason,
      usage: {
        schoolId,
        plan: result.plan,
        limit: result.limit,
        usedToday: result.usedToday,
        remaining: result.remaining,
        usageDate: result.usageDate,
        resetTime: getNextResetIsoString()
      }
    };
  } catch (error) {
    console.error('Atomic AI Quota Reservation Error:', error);
    return {
      allowed: false,
      reason: 'Failed to verify AI quota. Please try again.',
      usage: null
    };
  }
}

/**
 * Refund a request in case of catastrophic provider outage before any tokens were generated.
 */
async function rollbackQuota(schoolId, prisma = defaultPrisma) {
  if (!schoolId) return;
  const usageDate = getTodayDateString();
  try {
    const usage = await prisma.aiUsage.findUnique({
      where: {
        schoolId_usageDate: {
          schoolId,
          usageDate
        }
      }
    });
    if (usage && usage.requestCount > 0) {
      await prisma.aiUsage.update({
        where: { id: usage.id },
        data: { requestCount: { decrement: 1 } }
      });
    }
  } catch (err) {
    console.error('Failed to rollback AI quota:', err);
  }
}

module.exports = {
  getTodayDateString,
  getNextResetIsoString,
  getSchoolPlanAndLimit,
  getUsageStatus,
  checkAndReserveQuota,
  rollbackQuota
};
