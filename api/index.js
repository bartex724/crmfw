const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/src/app.module');

let cachedExpressApp = null;

async function getExpressApp() {
  if (cachedExpressApp) {
    return cachedExpressApp;
  }

  const app = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(app));
  await nestApp.init();
  cachedExpressApp = app;
  return app;
}

module.exports = async (req, res) => {
  const app = await getExpressApp();
  return app(req, res);
};
