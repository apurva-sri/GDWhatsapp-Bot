/**
 * Async Handler Utility
 *
 * THE PROBLEM THIS SOLVES:
 * ─────────────────────────
 * Every async controller in Express needs a try/catch:
 *
 *   const listFiles = async (req, res, next) => {
 *     try {
 *       const files = await driveService.listFiles();
 *       res.json(files);
 *     } catch (error) {
 *       next(error);  // ← You must remember this every time
 *     }
 *   };
 *
 * If you forget next(error), Express hangs — no response, no error.
 * With 10+ controllers each with 3-5 methods, that's 30+ try/catch blocks.
 *
 * THE SOLUTION:
 * ──────────────
 * Wrap your handler once with asyncHandler() and it auto-catches errors:
 *
 *   const listFiles = asyncHandler(async (req, res) => {
 *     const files = await driveService.listFiles();  // Throws? Auto-caught.
 *     res.json(files);
 *   });
 *
 * Any thrown error automatically goes to next(error) → global errorHandler.
 *
 * USAGE IN ROUTES:
 *   router.get("/files", protect, asyncHandler(listFiles));
 *
 * OR wrap in the controller itself:
 *   module.exports.listFiles = asyncHandler(async (req, res) => { ... });
 */

/**
 * Wraps an async Express route handler to auto-forward errors to next().
 *
 * @param {Function} fn - Async (req, res, next) => {} handler
 * @returns {Function}  - Express middleware that catches async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Execute the handler. If it returns a rejected Promise, catch it
    // and forward to Express's error handling pipeline via next(error).
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
