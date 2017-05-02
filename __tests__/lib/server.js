var get = require('../utils').get;
var File = require('vinyl');
var getPort = require('get-port');
var Server = require('../../src/serve/server');

var jsFile = new File({
  cwd: '/',
  base: '/test/',
  path: '/test/file.js',
  contents: new Buffer('var test = 123;')
});

var coffeeFile = new File({
  cwd: '/',
  base: '/test/',
  path: '/test/file.coffee',
  contents: new Buffer('test = 123')
});

var indexFile = new File({
  cwd: '/',
  base: '/test/',
  path: '/test/index.html',
  contents: new Buffer('<html>')
});

test('server - throws on bad port', function() {
  expect(function() {
    var server = new Server('${port}');
  }).toThrow();
  expect(function() {
    var server = new Server();
  }).toThrow();
});

test('server', function() {
  var server, port;
  return getPort()
    .then(_port => {
      port = _port;
      server = new Server(port, true);
      expect(server).toBeTruthy();
      return server.start();
    })
    .then(server => {
      return get(`http://localhost:${port}/file.coffee`)
        .catch(code => {
          expect(code).toEqual(404);
        })
        .then(() => {
          server.setFiles([coffeeFile]);
          return get(`http://localhost:${port}/file.coffee`)
            .then(text => {
              expect(text).toMatchSnapshot();
            })
            .then(() => {
              server.setFiles([coffeeFile, jsFile]);
              return get(`http://localhost:${port}/file.js`).then(text => {
                expect(text).toMatchSnapshot();
              });
            })
            .then(() => {
              server.setFiles([coffeeFile, indexFile, jsFile]);
              return get(`http://localhost:${port}/`, function(text) {
                expect(text).toMatchSnapshot();
              });
            })
            .then(done => {
              return server.stop();
            });
        });
    });
});
