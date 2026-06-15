var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var path = require('path');
var fs = require('fs');

var apiRouter = require('./routes/api');

var app = express();

app.use(logger('dev'));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', apiRouter);

app.use('/api', function(req, res) {
  res.status(404).json({ message: '找不到 API' });
});

var clientDistPath = process.env.TEAMUP_CLIENT_DIST_PATH || path.join(__dirname, '../client/dist');
var clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

app.get('*', function(req, res, next) {
  if (req.path.indexOf('/api') === 0) {
    next();
    return;
  }

  if (!fs.existsSync(clientIndexPath)) {
    res.status(503).json({
      message: 'Client build is missing. Run npm run build before starting the server.'
    });
    return;
  }

  res.sendFile(clientIndexPath);
});

module.exports = app;
