import cors from 'cors';

// Configure CORS options
const corsOptions = {
    // Allow specific origins (replace with your frontend URL in production)
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'https://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization', 'user_id'], // Allowed headers
    credentials: true, // Allow cookies/authorization headers
    optionsSuccessStatus: 200 // For legacy browser support
};

const corsMiddleware = cors(corsOptions);

export { corsMiddleware, corsOptions };
