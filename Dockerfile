# Use a lightweight Node.js image as a base
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# --- Dependencies Stage ---
FROM base AS deps
WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies needed for Prisma generate)
# Use --frozen-lockfile to ensure reproducibility
RUN pnpm install --frozen-lockfile

# --- Prisma Generate Stage ---
FROM deps AS prisma
WORKDIR /app

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma Client
# Ensure DATABASE_URL is set if needed during generation,
# although typically it's only needed at runtime or for migrations.
# You might need to pass build-time args if generation depends on it.
RUN pnpm exec prisma generate

# --- Build Stage (if needed - currently none) ---
# If you had a build step (e.g., TypeScript compilation), it would go here.

# --- Production Stage ---
FROM base AS production
WORKDIR /app

# Copy necessary files from previous stages
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/prisma ./prisma
COPY --from=prisma /app/package.json ./package.json

# Copy application source code
COPY src ./src

# Expose the port the app runs on
EXPOSE 3000

# Create logs directory and set permissions before switching user
RUN mkdir logs && chown node:node logs

# Switch to a non-root user for security
USER node

# Define the command to run the application
# This uses the "start" script implicitly defined by `node src/app.js`
CMD ["node", "src/app.js"]
