FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . ./
RUN mkdir -p /usr/src/app/data

EXPOSE 3000
CMD ["npm", "start"]
