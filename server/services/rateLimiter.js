// In-memory rate limiter for security-sensitive endpoints (forgot-password, login attempts, etc.)
class MemoryRateLimiter {
  constructor() {
    this.hits = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Express middleware for rate limiting
   * @param {Object} options
   * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
   * @param {number} options.max - Max attempts per window (default: 5)
   * @param {string} options.message - Error message when exceeded
   * @param {Function} [options.keyGenerator] - Function to determine key (default: IP)
   */
  middleware(options = {}) {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 5;
    const message = options.message || 'Too many requests from this IP, please try again later.';
    const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || 'unknown');

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();

      let record = this.hits.get(key);
      if (!record || (now - record.startTime > windowMs)) {
        record = { count: 1, startTime: now };
        this.hits.set(key, record);
      } else {
        record.count++;
      }

      const timeLeft = Math.ceil((record.startTime + windowMs - now) / 1000);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil((record.startTime + windowMs) / 1000));

      if (record.count > max) {
        return res.status(429).json({
          error: message,
          retryAfter: timeLeft
        });
      }

      next();
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now - record.startTime > 3600 * 1000) {
        this.hits.delete(key);
      }
    }
  }

  reset() {
    this.hits.clear();
  }
}

const rateLimiter = new MemoryRateLimiter();
module.exports = rateLimiter;
