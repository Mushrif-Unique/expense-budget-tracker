export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let message = 'Internal server error';
  if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON request body'; }
  else if (error.type === 'entity.too.large') { status = 413; message = 'Request body is too large'; }
  else if (error.code === 11000) { status = 409; message = 'An account with this email already exists.'; }
  else if (error.name === 'ValidationError') { status = 400; message = 'Invalid user data'; }
  return res.status(status).json({ success: false, message });
}
