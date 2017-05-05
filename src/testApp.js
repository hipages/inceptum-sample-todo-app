const { Swagger } = require('inceptum');
const app = require('express')();
const path = require('path');
const stringify = require('json-stringify-safe');

const swaggerFilePath = path.resolve(`${__dirname}/api/swagger/swagger.yaml`);

const port = process.env.PORT || 10010;

const sm = new Swagger.SwaggerMetadataMiddleware({ swaggerFilePath });
sm.register(app);

app.use((req, res, next) => {
  console.log(stringify(req));
  next();
});

app.get('/todo', (req, resp) => {
  resp.send('Hello');
});

let server = null;

process.on('SIGINT', () => {
  console.log('Shutting down app');
  try {
    server.close();
  } catch (e) {
    console.log('There was an error stopping the server', e);
  }
});

server = app.listen(port);
