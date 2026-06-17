var jwt = require('jsonwebtoken');
var db = require('../database/db');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

var JWT_SECRET = process.env.JWT_SECRET || 'teamup-campus-dev-secret';

function signToken(user) {
  return jwt.sign(
    {
      id: user.student_id,
      student_id: user.student_id,
      email: user.email,
      tokenVersion: Number(user.token_version || 0)
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getToken(req) {
  var header = req.headers.authorization || '';
  return header.indexOf('Bearer ') === 0 ? header.slice(7) : null;
}

function suspensionUntil(user) {
  return user.banned_until || user.suspended_until || null;
}

function suspensionMessage(user) {
  var until = suspensionUntil(user);
  if (!until) {
    return '帳號已被永久停權' + (user.suspended_reason ? '：' + user.suspended_reason : '');
  }
  return '帳號停權至 ' + until + (user.suspended_reason ? '：' + user.suspended_reason : '');
}

async function validatePayload(payload) {
  var user = await db.get('SELECT * FROM users WHERE student_id = ?', [payload.student_id || payload.id]);
  if (!user) {
    return { error: { status: 401, message: '登入狀態已失效，請重新登入' } };
  }

  var currentTokenVersion = Number(user.token_version || 0);
  var payloadTokenVersion = payload.tokenVersion === undefined ? 0 : Number(payload.tokenVersion);
  if (payloadTokenVersion !== currentTokenVersion) {
    return { error: { status: 401, message: '登入已失效，請重新登入' } };
  }

  if (user.is_suspended) {
    var until = suspensionUntil(user);
    if (!until || new Date(until).getTime() > Date.now()) {
      return {
        error: {
          status: 403,
          message: suspensionMessage(user),
          banned_until: until
        }
      };
    }

    await db.run(
      'UPDATE users SET is_suspended = 0, suspended_until = NULL, banned_until = NULL, suspended_reason = NULL WHERE student_id = ?',
      [user.student_id]
    );
  }

  return { user: user };
}

function authRequired(req, res, next) {
  var token = getToken(req);

  if (!token) {
    res.status(401).json({ message: '請先登入' });
    return;
  }

  var payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(401).json({ message: '登入已失效，請重新登入' });
    return;
  }

  validatePayload(payload)
    .then(function(result) {
      if (result.error) {
        res.status(result.error.status).json({
          message: result.error.message,
          banned_until: result.error.banned_until
        });
        return;
      }
      req.user = payload;
      next();
    })
    .catch(next);
}

function optionalAuth(req, res, next) {
  var token = getToken(req);

  if (!token) {
    next();
    return;
  }

  var payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    req.user = null;
    next();
    return;
  }

  validatePayload(payload)
    .then(function(result) {
      req.user = result.error ? null : payload;
      next();
    })
    .catch(next);
}

module.exports = {
  authRequired: authRequired,
  optionalAuth: optionalAuth,
  signToken: signToken
};
