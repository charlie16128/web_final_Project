var express = require('express');
var path = require('path');

var router = express.Router();
var publicDir = path.join(__dirname, '..', 'public');

router.get('/', function(req, res) {
  res.sendFile(path.join(publicDir, 'index.html'));
});

router.get('/login', function(req, res) {
  res.sendFile(path.join(publicDir, 'login.html'));
});

router.get('/register', function(req, res) {
  res.sendFile(path.join(publicDir, 'register.html'));
});

router.get('/groups/:id', function(req, res) {
  res.sendFile(path.join(publicDir, 'group.html'));
});

module.exports = router;
