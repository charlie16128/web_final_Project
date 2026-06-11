var jwt = require('jsonwebtoken');

var JWT_SECRET = process.env.JWT_SECRET || 'teamup-campus-dev-secret';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function getToken(req) {
  var header = req.headers.authorization || '';
  return header.indexOf('Bearer ') === 0 ? header.slice(7) : null;
}

function authRequired(req, res, next) {
  var token = getToken(req);

  if (!token) {
    res.status(401).json({ message: '請先登入' });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: '登入狀態已失效，請重新登入' });
  }
}

function optionalAuth(req, res, next) {
  var token = getToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = {
  authRequired: authRequired,
  optionalAuth: optionalAuth,
  signToken: signToken
};
