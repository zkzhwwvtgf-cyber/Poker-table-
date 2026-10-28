FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY engine.js server.js ./
COPY public ./public
ENV PORT=3000 DATA_FILE=/app/data/tables.json
EXPOSE 3000
CMD ["npm","start"]
