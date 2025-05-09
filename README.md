# Event Management Application - Backend

## Description

This project is the backend system for an Event Management Application built with Node.js, Express.js, and Prisma. It provides a RESTful API for managing events, ticket types, user authentication, orders, payments (simulated), e-ticket generation, check-in validation, and more. The application follows best practices for structure, security, and maintainability as outlined in the project's coding standards.

## Table of Contents

*   [Description](#description)
*   [Key Architectural Concepts](#key-architectural-concepts)
*   [Key Features](#key-features)
*   [Technologies Used](#technologies-used)
*   [Project Structure](#project-structure)
*   [API Endpoints Overview](#api-endpoints-overview)
*   [API Documentation](#api-documentation)
*   [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation & Setup](#installation--setup)
*   [Configuration](#configuration)
*   [Contributing](#contributing)
*   [License](#license)

## Key Architectural Concepts

This project adheres to several key architectural patterns and practices:

*   **MVC-like Structure:** Separation into Routes, Controllers, Services, and Models (Prisma).
*   **Service Layer:** Encapsulates business logic, interacting with the Prisma client.
*   **Prisma ORM:** Manages database interactions, schema definition, and migrations.
*   **Middleware:** Used extensively for cross-cutting concerns like authentication, authorization, validation, logging, error handling, rate limiting, and metrics.
*   **JWT Authentication:** Stateless authentication using JSON Web Tokens.
*   **Role-Based Access Control (RBAC):** Middleware enforces access based on user roles (Admin, User).
*   **Input Validation:** `express-validator` ensures data integrity before processing.
*   **Centralized Error Handling:** Consistent error responses and logging.
*   **Structured Logging:** Winston provides detailed request and error logs.
*   **Redis Caching:** Improves performance by caching frequently accessed data.
*   **Prometheus Metrics:** Exposes application performance metrics.
*   **Soft Deletes:** Preserves data by marking records as deleted instead of removing them permanently.
*   **File Uploads:** Securely handles file uploads using Multer.
*   **Transactional Operations:** Uses `prisma.$transaction` for atomic database operations (e.g., order creation, cancellation).

## Key Features

*   **User Management:** Registration, Login (JWT-based), Profile Management (including avatar uploads), Role-based access control (SuperAdmin, Admin, User/Participant).
*   **Event Management (Admin):** CRUD operations for events (including details, location, poster image URL, capacity, status).
*   **Ticket Type Management (Admin):** Define multiple ticket types per event (name, price, quantity/quota, sale dates, description). Supports pre-sale pricing logic (handled via service layer).
*   **Ordering & Checkout:**
    *   Users can browse and select tickets for events.
    *   Users can place orders for tickets (rule: 1 ticket per user per ticket type per event).
    *   Simulated manual payment processing.
    *   Order lifecycle management (pending, paid, canceled, etc.).
    *   Quota management for ticket types.
*   **E-Ticket Generation:** Automatic generation of unique e-tickets (with placeholder QR codes) upon successful payment.
*   **Ticket Details & Check-in:** Get specific ticket details via unique code (owner/admin). Admin can check-in tickets via unique code, with validation for event status ('published') and time window (1 hour before start).
*   **File Uploads:** Handles user avatar uploads using Multer with validation.
*   **Security:** JWT authentication, password hashing (PBKDF2 with salt), rate limiting, CORS configuration.
*   **Input Validation:** Uses `express-validator` for robust request validation.
*   **Error Handling:** Centralized error handling middleware.
*   **Logging:** Structured request and error logging using Winston.
*   **Caching:** Redis caching for performance optimization (e.g., user lists).
*   **Metrics:** Exposes application metrics for Prometheus via `prom-client`.
*   **Soft Deletes:** Implemented for key models (User, Event, TicketType) to preserve data history.

## Technologies Used

*   **Backend Framework:** Express.js
*   **Database ORM:** Prisma
*   **Database:** MySQL (configurable via `DATABASE_URL`)
*   **Authentication:** JSON Web Tokens (JWT)
*   **Password Hashing:** `crypto-js` (PBKDF2)
*   **Validation:** `express-validator`
*   **File Uploads:** Multer
*   **Caching:** Redis (`ioredis`)
*   **Logging:** Winston, `winston-daily-rotate-file`
*   **Metrics:** `prom-client`
*   **API Testing:** Jest, Supertest
*   **Package Manager:** pnpm
*   **Runtime:** Node.js

## Project Structure

The project follows a feature-based structure with a clear separation of concerns:

```
├── prisma/             # Prisma schema and migrations
├── src/
│   ├── api/v1/routes/  # API route definitions (versioned)
│   ├── config/         # Configuration files (db, auth, log, cors, redis, etc.)
│   ├── controllers/    # Request handlers (Express route logic)
│   ├── middlewares/    # Custom Express middleware (auth, error, validation, roles)
│   ├── models/         # Data models and Prisma client setup
│   ├── services/       # Business logic implementation
│   ├── utils/          # Utility functions (e.g., password hashing)
│   └── app.js          # Express application setup and server start
├── tests/              # Unit and integration tests
├── logs/               # Log files generated by Winston
├── uploads/            # Directory for uploaded files (e.g., avatars)
├── .env.development    # Example environment variables for development
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## API Endpoints Overview

All API endpoints are versioned under `/api/v1`.

*   `/api/v1/auth`: Authentication routes (register, login).
*   `/api/v1/users`: User management routes (get profile, update profile, list users (admin)).
*   `/api/v1/files`: File upload routes (e.g., avatars).
*   `/api/v1/events`: Event management routes (CRUD for events, ticket types).
*   `/api/v1/orders`: Order management routes (create order, list orders, get order details, cancel, checkout).
*   `/api/v1/tickets`: Ticket management routes (`GET /my` - User's paid tickets, `GET /paid` - Admin: all paid tickets, `GET /:uniqueCode` - Owner/Admin: specific ticket details, `POST /:uniqueCode/checkin` - Admin: check-in ticket).
*   `/api/v1/metrics`: Exposes Prometheus metrics.
*   `/api/v1/`: Miscellaneous routes (e.g., health check - if implemented).

*(Refer to specific route files in `src/api/v1/routes/` for detailed endpoint definitions, HTTP methods, and required middleware/validation.)*

## API Documentation

This project includes resources to help you explore and interact with the API:

*   **Postman Collection:** A Postman collection export is available at `postman-collection-export.json`. You can import this file into Postman to easily test the API endpoints.
    *   **Importing:** In Postman, go to `File > Import...` and select the `postman-collection-export.json` file.
    *   **Configuration:** The collection uses variables:
        *   `{{port}}`: Set this in your Postman environment or collection variables to match the port your application is running on (default: 3000).
        *   `{{auth_token}}`: This variable is automatically set by the "login" request's test script upon successful login. Most protected endpoints use this variable for Bearer token authentication.
        *   `{{orderCode}}`: Automatically set by the "Order" request upon successful order creation. Used by subsequent order-related requests.
        *   `{{ticketTest}}`: You might need to manually set this variable with a valid ticket `uniqueCode` obtained from creating an order and payment, or by fetching tickets, to test the specific ticket endpoints.
    *   **Usage:** The collection includes pre-configured requests for various operations. Some requests (like `register`, `login`, `Buat Event`) have example request bodies commented out in the "Body > raw" tab. You'll need to uncomment and potentially modify these examples to use them.
*   **Swagger/OpenAPI Specification:** A Swagger 2.0 specification file is available at `swagger.json`. This file describes the API structure and can be used with tools like Swagger UI for interactive documentation and exploration.

## Getting Started

### Prerequisites

*   Node.js (Check `package.json` for engine requirements if specified, otherwise use a recent LTS version)
*   pnpm (`npm install -g pnpm`)
*   MySQL Server
*   Redis Server

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd event-app
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.development .env
        ```
    *   Edit the `.env` file and provide your actual configuration values:
        *   `PORT`: The port the application will run on (default: 3000).
        *   `DATABASE_URL`: Your MySQL connection string (e.g., `mysql://user:password@host:port/database`).
        *   `JWT_SECRET`: A strong, unique secret key for signing JWTs. **Change the default value!**
        *   `JWT_EXPIRES_IN`: Token expiration time (e.g., "1h", "7d").
        *   `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`: Connection details for your Redis instance.
        *   Other variables as needed (CORS, Logging, Rate Limiting).

4.  **Set up the database:**
    *   Ensure your MySQL server is running and the database specified in `DATABASE_URL` exists.
    *   Run Prisma migrations to create the database schema:
        ```bash
        npx prisma migrate dev
        ```

5.  **Run the application:**
    *   **Development mode (with hot-reloading):**
        ```bash
        pnpm dev
        ```
    *   **Production mode:**
        ```bash
        pnpm start
        ```

The server should now be running on the specified `PORT` (default: `http://localhost:3000`). You can interact with the API using tools like Postman (see [API Documentation](#api-documentation) for collection setup) or Swagger UI. Note that the included Postman collection contains raw request body examples for many endpoints.

## Configuration

All configuration is managed through environment variables loaded via `dotenv` (implicitly by Prisma and potentially explicitly in `app.js`). Key variables are defined in the `.env` file (copied from `.env.development`).

*   `NODE_ENV`: Set to `development` or `production`.
*   `PORT`: Application port.
*   `DATABASE_URL`: MySQL connection string.
*   `JWT_SECRET`: Secret for JWT signing.
*   `JWT_EXPIRES_IN`: JWT expiration time.
*   `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`: Redis connection details.
*   `CORS_ORIGIN`: Allowed origins for CORS.
*   `LOG_DIR`, `LOG_LEVEL`: Logging configuration.
*   `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`: Rate limiting settings.
*   `MAX_FILE_SIZE_MB`: Maximum file upload size (used by Multer config).

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/arrosyid/event-app/blob/master/LICENSE) file for details.
