const AppError = require('../utils/AppError');

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return next(new AppError('Forbidden: insufficient role', 403));
    }
    next();
  };
}

module.exports = requireRole;
