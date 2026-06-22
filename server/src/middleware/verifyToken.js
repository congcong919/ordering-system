const { auth } = require('../services/firebase');
const AppError = require('../utils/AppError');

async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authorization header missing', 401));
  }
  try {
    const decoded = await auth.verifyIdToken(header.slice(7));
    req.user = decoded;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = verifyToken;
