FROM node:22-bookworm-slim
WORKDIR /app
COPY runtime-package.json package.json
RUN npm install --omit=dev
COPY dist/controller.cjs ./controller.cjs
ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "controller.cjs"]
