import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Enable default metrics collection
client.collectDefaultMetrics({ register });

// Create a histogram metric for HTTP request durations
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 5] // Define buckets for histogram (in seconds)
});

// Register the histogram
register.registerMetric(httpRequestDurationMicroseconds);

export { register, httpRequestDurationMicroseconds };
