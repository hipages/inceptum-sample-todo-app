const SwaggerExpress = require('swagger-express-mw');
const app = require('express')();
const { BaseContext, LogManager } = require('inceptum');
const co = require('co');
const path = require('path');

LogManager.setAppName('swagger-example');
const log = LogManager.getLogger(__filename);

log.info({ content: 'fine' }, 'This is a message');
log.debug({ content: 'wrong' }, 'This is a debug message');

const config = {
  appRoot: __dirname, // required config
};

BaseContext.registerSingletonsInDir(path.join(config.appRoot, 'api/controllers/'));
BaseContext.registerSingletonsInDir(path.join(config.appRoot, 'service/'));

let server = null;

process.on('SIGINT', () => {
  console.log('Shutting down app');
  try {
    server.close();
  } catch (e) {
    console.log('There was an error stopping the server', e);
  }
  co(function* () {
    yield BaseContext.lcStop();
  }).then(() => process.exit());
});

co(function* () {
  console.log('Starting context');
  yield BaseContext.lcStart();
}).then(
  () => {
    SwaggerExpress.create(config, (err, swaggerExpress) => {
      if (err) { throw err; }

      // install middleware
      swaggerExpress.register(app);

      const port = process.env.PORT || 10010;
      server = app.listen(port);

      console.log(`try this:\ncurl http://127.0.0.1:${port}/swagger`);
    });
  }
);

module.exports = app; // for testing
