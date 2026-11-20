// Wrap async route handlers: errors with a .status become that HTTP status, others 500.
module.exports = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
  }
};
