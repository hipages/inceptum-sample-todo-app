const { InceptumSwaggerApp } = require('inceptum');
const path = require('path');

const swaggerFilePath = path.resolve(`${__dirname}/../config/swagger.yaml`);

const inceptum = new InceptumSwaggerApp(swaggerFilePath);
const context = inceptum.getContext();

context.registerSingletonsInDir(path.resolve(`${__dirname}/controllers`));
context.registerSingletonsInDir(path.resolve(`${__dirname}/service`));

inceptum.start();

module.exports = inceptum; // for testing
