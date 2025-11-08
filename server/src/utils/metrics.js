const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  app: 'codedojo-server',
});

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const wsConnectionsActive = new client.Gauge({
  name: 'ws_connections_active',
  help: 'Number of active WebSocket connections',
});

const wsMessagesTotal = new client.Counter({
  name: 'ws_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'event'],
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(wsConnectionsActive);
register.registerMetric(wsMessagesTotal);
register.registerMetric(dbQueryDuration);

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  wsConnectionsActive,
  wsMessagesTotal,
  dbQueryDuration,
};
