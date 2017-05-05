const debug = require('debug')('inceptum:fittings');

module.exports = function create(fittingDef, pipes) {

  const swaggerNodeRunner = pipes.config.swaggerNodeRunner;
  const mockMode = !!fittingDef.mockMode || !!swaggerNodeRunner.config.swagger.mockMode;

  const routerConfig = {
    useStubs: mockMode
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
