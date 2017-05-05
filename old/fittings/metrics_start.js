const debug = require('debug')('inceptum:fittings');
const path = require('path');
const assert = require('assert');

module.exports = function create(fittingDef, pipes) {
  assert(Array.isArray(fittingDef.controllersDirs), 'controllersDirs must be an array');
  assert(Array.isArray(fittingDef.mockControllersDirs), 'mockControllersDirs must be an array');

  const swaggerNodeRunner = pipes.config.swaggerNodeRunner;
  const appRoot = swaggerNodeRunner.config.swagger.appRoot;

  const mockMode = !!fittingDef.mockMode || !!swaggerNodeRunner.config.swagger.mockMode;

  let controllers = mockMode ? fittingDef.mockControllersDirs : fittingDef.controllersDirs;

  controllers = controllers.map((dir) => path.resolve(appRoot, dir));

  const routerConfig = {
    useStubs: mockMode,
    controllers
  };
  debug('swaggerTools router config: %j', routerConfig);
// eslint-disable-next-line global-require
  const middleware = require('./inceptum_router_middleware')(routerConfig);

  return (context, cb) => {
    // const proxy = new Proxy(context.response, {
    //   set: (target, property, value) => {
    //     target[property] = value;
    //     if (property === 'statusCode') {
    //       console.log('Access to status code');
    //     }
    //     return true;
    //   }
    // });
    middleware(context.request, context.response, cb);
  };
};
