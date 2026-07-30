FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV AGENTSHIRE_STANDALONE=1
ENV AGENTSHIRE_STATE_DIR=/data/agentshire
ENV PORT=7860

COPY Agentshire/package*.json ./Agentshire/
COPY Agentshire/town-frontend/package*.json ./Agentshire/town-frontend/

RUN npm ci --prefix Agentshire \
  && npm ci --prefix Agentshire/town-frontend

COPY Agentshire ./Agentshire

RUN npm run build --prefix Agentshire/town-frontend

EXPOSE 7860
CMD ["npm", "run", "start:standalone", "--prefix", "Agentshire"]
