# Single stage on purpose: `npm start` runs the server through tsx rather than compiling
# it, so the runtime needs the dev dependencies anyway. Splitting this into a slim
# runtime stage buys little here and costs clarity — revisit if image size matters.
FROM node:22-alpine

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Builds the SPA into dist/web and typechecks the whole project, so a type error fails
# the image build rather than showing up at runtime.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
