// Consistent API response formatter
/**
 * Response Formatter Utility
 *
 * WHY THIS EXISTS:
 * ─────────────────
 * Without a formatter, every controller writes responses differently:
 *   res.json({ data: files })
 *   res.json({ result: files, ok: true })
 *   res.status(200).send({ files })
 *
 * The frontend can't reliably parse any of these.
 *
 * With this formatter, EVERY response in the app has the same shape:
 * {
 *   success: true | false,
 *   message: "Human readable description",
 *   data:    <payload> | null,
 *   errors:  <validation errors> | null   (only on failure)
 * }
 *
 * Frontend code becomes simple:
 *   if (response.data.success) { use(response.data.data) }
 *   else { show(response.data.message) }
 */

// ─── Success Responses ────────────────────────────────────────────

/**
 * 200 OK — Standard success response
 * Use for: GET requests, successful operations
 *
 * @example
 * return successResponse(res, "Files retrieved", files);
 * // → { success: true, message: "Files retrieved", data: [...] }
 */
const successResponse = (res, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * 201 Created — Resource was successfully created
 * Use for: POST requests that create a new resource
 *
 * @example
 * return createdResponse(res, "File uploaded", newFile);
 */
const createdResponse = (res, message, data = null) => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

/**
 * Paginated response — for list endpoints with pagination
 * Use for: GET /files, GET /history, GET /logs etc.
 *
 * @param {object} res
 * @param {string} message
 * @param {Array}  data       - The array of items for this page
 * @param {object} pagination - { page, limit, total, totalPages }
 *
 * @example
 * return paginatedResponse(res, "Files retrieved", files, {
 *   page: 1, limit: 10, total: 47, totalPages: 5
 * });
 */
const paginatedResponse = (res, message, data, pagination) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page:       pagination.page,
      limit:      pagination.limit,
      total:      pagination.total,
      totalPages: pagination.totalPages,
      hasNext:    pagination.page < pagination.totalPages,
      hasPrev:    pagination.page > 1,
    },
  });
};

// ─── Error Responses ──────────────────────────────────────────────

/**
 * Generic error response
 * Use for: any error with a custom status code
 *
 * @param {object}      res
 * @param {string}      message    - Human-readable error message for the user
 * @param {number}      statusCode - HTTP status code (default 500)
 * @param {Array|null}  errors     - Validation error details (optional)
 *
 * @example
 * return errorResponse(res, "Email is required", 400);
 */
const errorResponse = (res, message, statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * 400 Bad Request — Invalid input from client
 * Use for: missing fields, invalid formats, bad query params
 *
 * @example
 * return badRequestResponse(res, "Email is required");
 */
const badRequestResponse = (res, message, errors = null) => {
  return errorResponse(res, message, 400, errors);
};

/**
 * 401 Unauthorized — Not logged in
 * Use for: missing/invalid/expired JWT
 *
 * @example
 * return unauthorizedResponse(res, "Session expired. Please log in again.");
 */
const unauthorizedResponse = (res, message = "Unauthorized. Please log in.") => {
  return errorResponse(res, message, 401);
};

/**
 * 403 Forbidden — Logged in but not allowed
 * Use for: user tries to access another user's resource
 *
 * @example
 * return forbiddenResponse(res, "You don't have permission to delete this file.");
 */
const forbiddenResponse = (res, message = "Forbidden. You don't have permission.") => {
  return errorResponse(res, message, 403);
};

/**
 * 404 Not Found — Resource doesn't exist
 * Use for: file not found, user not found, route not found
 *
 * @example
 * return notFoundResponse(res, "File not found");
 */
const notFoundResponse = (res, message = "Resource not found") => {
  return errorResponse(res, message, 404);
};

/**
 * 409 Conflict — Resource already exists
 * Use for: duplicate email, duplicate file name
 *
 * @example
 * return conflictResponse(res, "A file with this name already exists");
 */
const conflictResponse = (res, message = "Conflict. Resource already exists.") => {
  return errorResponse(res, message, 409);
};

/**
 * 429 Too Many Requests — Rate limit hit
 * Use for: API rate limiter
 *
 * @example
 * return tooManyRequestsResponse(res, "Too many requests. Try again in 60 seconds.");
 */
const tooManyRequestsResponse = (res, message = "Too many requests. Please slow down.") => {
  return errorResponse(res, message, 429);
};

/**
 * 500 Internal Server Error — Something crashed on the server
 * Use for: unexpected errors in catch blocks
 *
 * @example
 * return serverErrorResponse(res, "Failed to connect to Google Drive");
 */
const serverErrorResponse = (res, message = "Internal server error. Please try again.") => {
  return errorResponse(res, message, 500);
};

module.exports = {
  // Success
  successResponse,
  createdResponse,
  paginatedResponse,
  // Errors
  errorResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  tooManyRequestsResponse,
  serverErrorResponse,
};