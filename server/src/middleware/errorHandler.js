const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  logger.error(err.message, {
    statusCode,
    requestId: req.requestId,
    userId: req.user?.uid,
    method: req.method,
    path: req.path,
    stack: statusCode === 500 ? err.stack : undefined,
  });

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
