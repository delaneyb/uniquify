FROM node:lts-alpine
COPY package*.json /app/
WORKDIR /app
CMD npm ci install && npm start
EXPOSE 3000