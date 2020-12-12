FROM node:15.4.0-alpine
RUN apk --no-cache add git
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ADD https://www.google.com /time.now
COPY ./package.json /usr/src/app
COPY ./tsconfig.json /usr/src/app
COPY ./server /usr/src/app/server
COPY ./shared /usr/src/app/shared
RUN npm install
RUN cd server && npm run setup && npm cache clean --force
RUN cd server/content && npm install
RUN cd server && npm run build
ENV NODE_ENV production
ENV PORT 80
EXPOSE 80
CMD cd server && npm start