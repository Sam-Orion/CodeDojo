const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config/env');
const correlationIdMiddleware = require('./middlewares/correlationId');
const requestLogger = require('./middlewares/requestLogger');
const metricsMiddleware = require('./middlewares/metrics');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const fileUploadMiddleware = require('./middlewares/fileUpload');
const routes = require('./routes');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUploadMiddleware);

app.use(correlationIdMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);

const clientPublicPath = path.join(__dirname, '..', '..', 'client', 'src', 'public');
app.use(express.static(clientPublicPath));

app.use('/api/v1', routes);

app.get('/', (req, res) => {
  res.json({
    message: 'CodeDojo API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
