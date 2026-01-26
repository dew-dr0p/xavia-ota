FROM node:18.18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build


FROM node:18.18-alpine AS runner

WORKDIR /app
RUN chown -R node:node /app

# Copy files from builder stage
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]