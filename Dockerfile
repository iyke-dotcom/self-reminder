# Self Reminder sync backend — host config (one file).
# Works on Render, Fly.io, Railway, or any Docker host / VPS.
# Persistent data lives in /data: mount a volume or disk there so reminders
# survive restarts (PGlite keeps its PostgreSQL files under $DATA_DIR).
FROM node:24-alpine

WORKDIR /app

# Production dependencies only. PGlite ships its WASM inside the package, so
# there is no build step; --ignore-scripts skips the husky dev hook.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Server only: the browser app is deployed separately (e.g. Netlify).
COPY server ./server

# Hosts inject $PORT (Render uses 10000, Fly.io uses 8080).
ENV DATA_DIR=/data/.pgdata
EXPOSE 10000
VOLUME /data

# Required at runtime (see README "Host the sync backend"):
#   JWT_SECRET          long random string (signs login tokens)
#   CLIENT_ORIGINS      your app URL(s), e.g. https://self-reminder1.netlify.app
CMD ["node", "server/index.js"]
