/**
 * Centralized global error handling middleware
 */
export function errorHandler(err, req, res, next) {
  // Log the complete error stack in development/internal logs
  console.error(`[Error Middleware] Intercepted Error:`, err);

  // If the headers have already been sent to the client, delegate to the default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message || 'Ошибка валидации данных.'
    });
  }

  if (err && err.issues) {
    // This handles Zod error structures
    return res.status(400).json({
      error: 'Некорректные параметры запроса.',
      details: err.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    });
  }

  // Clean error response (hide system/database stack traces in production)
  const statusCode = err.status || err.statusCode || 500;
  const clientMessage = statusCode === 500
    ? 'Что-то пошло не так. Пожалуйста, попробуйте позже.'
    : err.message;

  res.status(statusCode).json({ error: clientMessage });
}

export default errorHandler;
