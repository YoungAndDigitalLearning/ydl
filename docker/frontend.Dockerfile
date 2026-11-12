FROM node:10-buster

WORKDIR /app

COPY ydl-front/package.json ./
COPY ydl-front/package-lock.json ./

RUN npm ci --no-audit

COPY ydl-front/ ./

EXPOSE 8080

CMD ["npm", "run", "dev"]