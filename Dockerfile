# Next.js-app (web/) + Python-tool voor advertenties (tools/) in één container
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY tools/requirements.txt tools/requirements.txt
RUN python3 -m venv tools/.venv && tools/.venv/bin/pip install --no-cache-dir -r tools/requirements.txt

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY tools /app/tools
COPY web ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
