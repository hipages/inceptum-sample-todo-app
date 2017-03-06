/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Apigee Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Extensively modified by Paolo Ragone.
 *
 */

const co = require('co');
const _ = require('lodash-compat');
const debug = require('debug')('inceptum:middleware:router');
const specs = require('swagger-tools').specs;
const { WebContext } = require('inceptum');

// ************************ Helper methods

const swaggerOperationMethods = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT'
];

function isModelType(spec, type) {
  return spec.primitives.indexOf(type) === -1;
}

function debugError(err, debug) {
  let reason = err.message.replace(/^.*validation failed: /, '');

  reason = reason.charAt(0).toUpperCase() + reason.substring(1);

  debug('  Reason: %s', reason);

  if (err.failedValidation === true) {
    if (err.results) {
      debug('  Errors:');

      _.each(err.results.errors, (error, index) => {
        debug('    %d:', index);
        debug('      code: %s', error.code);
        debug('      message: %s', error.message);
        debug('      path: %s', JSON.stringify(error.path));
      });
    }
  }

  if (err.stack) {
    debug('  Stack:');

    _.each(err.stack.split('\n'), (line, index) => {
      // Skip the first line since it's in the reasonx
      if (index > 0) {
        debug('  %s', line);
      }
    });
  }
}

function coerceVersion(version) {
  // Convert the version to a number (Required for helpers.getSpec)
  if (version && !_.isString(version)) {
    version = version.toString();

    // Handle rounding issues (Only required for when Swagger version ends in '.0')
    if (version.indexOf('.') === -1) {
      version += '.0';
    }
  }

  return version;
}

function getSpec(version, throwError) {
  let spec;

  version = coerceVersion(version);

  switch (version) {
    case '1.2':
      spec = specs.v1_2; // jshint ignore:line

      break;

    case '2.0':
      spec = specs.v2_0; // jshint ignore:line

      break;

    default:
      if (throwError === true) {
        throw new Error(`Unsupported Swagger version: ${version}`);
      }
  }

  return spec;
}

function send(resp, res) {
  if (_.isPlainObject(resp)) {
    res.json(resp);
  } else if (typeof resp === 'string') {
    res.send(resp);
  }
}

// ************************ End of Helper methods

const defaultOptions = {
  controllers: {},
  useStubs: false // Should we set this automatically based on process.env.NODE_ENV?
};

const optionParsingRegExp = /^\s*([^\s]*)\s*\((.*)\)/;
const optionParsingRegExp2 = /[a-zA-Z0-9?:@_-]+/g;
function createControllerArgHandler(controller, operationId) {
  let functionName;
  let params = [];
  if (operationId.indexOf('(') < 0) {
    functionName = operationId.trim();
  } else {
    const matches = operationId.match(optionParsingRegExp);
    functionName = matches[1];
    if (matches[2].trim().length > 0) {
      params = matches[2].match(optionParsingRegExp2);
    }
  }
  const paramFunctions = [];
  params.forEach((param) => {
    if (param === 'null') {
      paramFunctions.push(() => null);
    } else {
      switch (param.substr(0, 1)) {
        case '@':
          switch (param) {
            case '@req':
              paramFunctions.push((req) => req);
              break;
            case '@res':
              paramFunctions.push((req, res) => res);
              break;
            default:
              throw new Error(`Unknown @ parameter ${param}`);
          }
          break;
        default:
          paramFunctions.push(
            (req) => req.swagger.params[param].value
          );
      }
    }
  });
  return (req, res) => {
    const args = paramFunctions.map((f) => f(req, res));
    const resp = controller[functionName](...args);
    if (resp) {
      if (resp.next) {
        return co(resp).then((result) => {
          send(result, res);
        }, (err) => {
          console.log(err);
          send(err, res);
        });
      }
      return send(resp, res);
    }
    return resp;
  };
}

function* createHandler(req) {
  const controllerName = req.swagger.operation['x-swagger-router-controller'] ?
    req.swagger.operation['x-swagger-router-controller'] :
    req.swagger.path['x-swagger-router-controller'];
  try {
    const controller = yield WebContext.getObjectByName(controllerName);
    return createControllerArgHandler(controller,
      req.swagger.operation.operationId ?
        req.swagger.operation.operationId :
        req.method.toLowerCase());
  } catch (e) {
    console.log(e);
    throw e;
  }
}

function getHandlerName(req) {
  let handlerName;

  switch (req.swagger.swaggerVersion) {
    case '1.2':
      handlerName = req.swagger.operation.nickname;
      break;

    case '2.0':
      if (req.swagger.operation['x-swagger-router-controller'] || req.swagger.path['x-swagger-router-controller']) {
        handlerName = `${req.swagger.operation['x-swagger-router-controller'] ?
            req.swagger.operation['x-swagger-router-controller'] :
            req.swagger.path['x-swagger-router-controller']}_${
          req.swagger.operation.operationId ? req.swagger.operation.operationId : req.method.toLowerCase()}`;
      } else {
        handlerName = req.swagger.operation.operationId;
      }

      break;
    default:
      throw new Error('Unknown swagger version');
  }

  return handlerName;
}

const getMockValue = function (version, schema) {
  let type = _.isPlainObject(schema) ? schema.type : schema;
  let value;

  if (!type) {
    type = 'object';
  }

  switch (type) {
    case 'array':
      value = [getMockValue(version, _.isArray(schema.items) ? schema.items[0] : schema.items)];

      break;

    case 'boolean':
      if (version === '1.2' && !_.isUndefined(schema.defaultValue)) {
        value = schema.defaultValue;
      } else if (version === '2.0' && !_.isUndefined(schema.default)) {
        value = schema.default;
      } else if (_.isArray(schema.enum)) {
        value = schema.enum[0];
      } else {
        value = 'true';
      }

      // Convert value if necessary
      value = !!(value === 'true' || value === true);

      break;

    case 'file':
    case 'File':
      value = 'Pretend this is some file content';

      break;

    case 'integer':
      if (version === '1.2' && !_.isUndefined(schema.defaultValue)) {
        value = schema.defaultValue;
      } else if (version === '2.0' && !_.isUndefined(schema.default)) {
        value = schema.default;
      } else if (_.isArray(schema.enum)) {
        value = schema.enum[0];
      } else {
        value = 1;
      }

      // Convert value if necessary
      if (!_.isNumber(value)) {
        value = parseInt(value, 10);
      }

      // TODO: Handle constraints and formats

      break;

    case 'object':
      value = {};

      _.each(schema.allOf, (parentSchema) => {
        _.each(parentSchema.properties, (property, propName) => {
          value[propName] = getMockValue(version, property);
        });
      });

      _.each(schema.properties, (property, propName) => {
        value[propName] = getMockValue(version, property);
      });

      break;

    case 'number':
      if (version === '1.2' && !_.isUndefined(schema.defaultValue)) {
        value = schema.defaultValue;
      } else if (version === '2.0' && !_.isUndefined(schema.default)) {
        value = schema.default;
      } else if (_.isArray(schema.enum)) {
        value = schema.enum[0];
      } else {
        value = 1.0;
      }

      // Convert value if necessary
      if (!_.isNumber(value)) {
        value = parseFloat(value);
      }

      // TODO: Handle constraints and formats

      break;

    case 'string':
      if (version === '1.2' && !_.isUndefined(schema.defaultValue)) {
        value = schema.defaultValue;
      } else if (version === '2.0' && !_.isUndefined(schema.default)) {
        value = schema.default;
      } else if (_.isArray(schema.enum)) {
        value = schema.enum[0];
      } else if (schema.format === 'date') {
        value = new Date().toISOString().split('T')[0];
      } else if (schema.format === 'date-time') {
        value = new Date().toISOString();
      } else {
        value = 'Sample text';
      }

      break;

    default:
      throw new Error(`Don't know how to mock a value of type ${type}`);
  }

  return value;
};
const mockResponse = (req, res, next, handlerName) => {
  const method = req.method.toLowerCase();
  const operation = req.swagger.operation;
  const sendResponse = function (err, response) {
    if (err) {
      debug('next with error: %j', err);
      return next(err);
    }
    debug('send mock response: %s', response);

      // Explicitly set the response status to 200 if not present (Issue #269)
    if (_.isUndefined(req.statusCode)) {
      res.statusCode = 200;
    }

      // Mock mode only supports JSON right now
    res.setHeader('Content-Type', 'application/json');

    return res.end(response);
  };
  const spec = getSpec(req.swagger.swaggerVersion);
  const stubResponse = `Stubbed response for ${handlerName}`;
  let apiDOrSO;
  let responseType;

  switch (req.swagger.swaggerVersion) {
    case '1.2':
      apiDOrSO = req.swagger.apiDeclaration;
      responseType = operation.type;

      break;

    case '2.0':
      apiDOrSO = req.swagger.swaggerObject;

      if (method === 'post' && operation.responses['201']) {
        responseType = operation.responses['201'];

        res.statusCode = 201;
      } else if (method === 'delete' && operation.responses['204']) {
        responseType = operation.responses['204'];

        res.statusCode = 204;
      } else if (operation.responses['200']) {
        responseType = operation.responses['200'];
      } else if (operation.responses.default) {
        responseType = operation.responses.default;
      } else {
        responseType = 'void';
      }

      break;
    default:
      throw new Error('Unknown swagger version');
  }

  if (_.isPlainObject(responseType) || isModelType(spec, responseType)) {
    if (req.swagger.swaggerVersion === '1.2') {
      spec.composeModel(apiDOrSO, responseType, (err, result) => {
        if (err) {
          return sendResponse(undefined, err);
        }
          // Should we handle this differently as undefined typically means the model doesn't exist
        return sendResponse(undefined, _.isUndefined(result) ?
            stubResponse :
            JSON.stringify(getMockValue(req.swagger.swaggerVersion, result)));
      });
    } else {
      return sendResponse(undefined, JSON.stringify(getMockValue(req.swagger.swaggerVersion, responseType.schema || responseType)));
    }
  } else {
    return sendResponse(undefined, getMockValue(req.swagger.swaggerVersion, responseType));
  }
  return null;
};
const createStubHandler = function (req, res, next, handlerName) {
  // TODO: Handle headers for 2.0
  // TODO: Handle examples (per mime-type) for 2.0
  // TODO: Handle non-JSON response types

  return function stubHandler(req, res, next) {
    mockResponse(req, res, next, handlerName);
  };
};

const send405 = function (req, res, next) {
  const allowedMethods = [];
  const err = new Error(`Route defined in Swagger specification (${
    _.isUndefined(req.swagger.api) ? req.swagger.apiPath : req.swagger.api.path
    }) but there is no defined ${
    req.swagger.swaggerVersion === '1.2' ? req.method.toUpperCase() : req.method.toLowerCase()} operation.`);

  if (!_.isUndefined(req.swagger.api)) {
    _.each(req.swagger.api.operations, (operation) => {
      allowedMethods.push(operation.method.toUpperCase());
    });
  } else {
    _.each(req.swagger.path, (operation, method) => {
      if (swaggerOperationMethods.indexOf(method.toUpperCase()) !== -1) {
        allowedMethods.push(method.toUpperCase());
      }
    });
  }

  err.allowedMethods = allowedMethods;

  res.setHeader('Allow', allowedMethods.sort().join(', '));
  res.statusCode = 405;

  return next(err);
};

/**
 * Middleware for using Swagger information to route requests to handlers.  Due to the differences between Swagger 1.2
 * and Swagger 2.0, the way in which your Swagger document(s) are annotated to work with this middleware differs as well
 * so please view the documentation below for more details:
 *
 *     https://github.com/apigee-127/swagger-tools/blob/master/docs/Middleware.md#swaggerrouteroptions
 *
 * This middleware also requires that you use the swagger-metadata middleware before this middleware.  This middleware
 * also makes no attempt to work around invalid Swagger documents.  If you would like to validate your requests using
 * the swagger-validator middleware, you must use it prior to using this middleware.
 *
 * @param {object} [options] - The middleware options
 * @param {boolean} [options.useStubs=false] - Whether or not to stub missing controllers and methods
 *
 * @returns the middleware function
 */
module.exports = function (options) {
  const handlerCache = {};

  debug('Initializing swagger-router middleware');

  // Set the defaults
  options = _.defaults(options || {}, defaultOptions);

  debug('  Mock mode: %s', options.useStubs === true ? 'enabled' : 'disabled');

  return (req, res, next) => {
    if (!req.swagger) {
      next();
      return;
    }
    const operation = req.swagger ? req.swagger.operation : undefined;
    req.swagger.useStubs = options.useStubs;

    debug('%s %s', req.method, req.url);
    debug('  Will process: %s', _.isUndefined(operation) ? 'no' : 'yes');

    if (!operation) {
      debug('  No handler for method: %s', req.method);
      send405(req, res, next);
      return;
    }
    const handlerName = getHandlerName(req);
    let handler = handlerCache[handlerName];
    if (_.isUndefined(handler) && options.useStubs === true) {
      handler = handlerCache[handlerName] = createStubHandler(handlerName);
    }
    if (!_.isUndefined(handler)) {
      try {
        const r = handler(req, res);
        if (r instanceof Promise) {
          r.then((res) => {
            if (res instanceof Error) {
              console.log(res);
              next(res);
            } else {
              next(null, res);
            }
          })
            .catch(next);
          return;
        }
        next(null, r);
        return;
      } catch (err) {
        debug('Handler threw an unexpected error: %s\n%s', err.message, err.stack);
        debugError(err, debug);
        next(err);
        return;
      }
    } else {
      // The handler is not defined, and it's not a stub
      co(function* () {
        let rErr;
        handler = handlerCache[handlerName] = yield createHandler(req);

        if (!_.isUndefined(handler)) {
          try {
            const r = handler(req, res);
            if (r instanceof Promise) {
              return yield r;
            }
            return r;
          } catch (err) {
            rErr = err;
            debug('Handler threw an unexpected error: %s\n%s', err.message, err.stack);
            console.log(err);
          }
        } else if (options.ignoreMissingHandlers !== true) {
          rErr = new Error(`Cannot resolve the configured swagger-router handler: ${handlerName}`);

          res.statusCode = 500;
        }

        if (rErr) {
          debugError(rErr, debug);
        }

        return rErr;
      }).then((r) => ((r instanceof Error) ? next(r) : next(null, r))).catch(next);
    }
  };
};
