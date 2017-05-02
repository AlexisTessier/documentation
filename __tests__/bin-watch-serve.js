'use strict';

var path = require('path'),
  os = require('os'),
  get = require('./utils').get,
  spawn = require('child_process').spawn,
  fs = require('fs');

function documentation(args, options) {
  if (!options) {
    options = {};
  }
  if (!options.cwd) {
    options.cwd = __dirname;
  }

  options.maxBuffer = 1024 * 1024;
  args.unshift(path.join(__dirname, '..', 'bin', 'documentation.js'));

  return spawn('node', args, options);
}

function normalize(result) {
  result.forEach(function(item) {
    item.context.file = '[path]';
  });
  return result;
}

const timeout = 20000;

test('harness', function() {
  var docProcess = documentation(['fixture/simple.input.js', '--serve']);
  expect(docProcess).toBeTruthy();
  docProcess.kill();
});

test(
  'provides index.html',
  function(done) {
    var docProcess = documentation(['serve', 'fixture/simple.input.js']);
    docProcess.stdout.on('data', function(data) {
      expect(data.toString().trim()).toBe(
        'documentation.js serving on port 4001'
      );
      get('http://localhost:4001/', function(text) {
        expect(text.match(/<html>/)).toBeTruthy();
        docProcess.kill();
        done();
      });
    });
  },
  timeout
);

test(
  'accepts port argument',
  function(done) {
    var docProcess = documentation([
      'serve',
      'fixture/simple.input.js',
      '--port=4004'
    ]);
    docProcess.stdout.on('data', function(data) {
      expect(data.toString().trim()).toBe(
        'documentation.js serving on port 4004'
      );
      get('http://localhost:4004/', function(text) {
        expect(text.match(/<html>/)).toBeTruthy();
        docProcess.kill();
        done();
      });
    });
  },
  timeout
);

test(
  '--watch',
  function(done) {
    var tmpFile = path.join(os.tmpdir(), '/simple.js');
    fs.writeFileSync(tmpFile, '/** a function */function apples() {}');
    var docProcess = documentation(['serve', tmpFile, '--watch']);
    docProcess.stdout.on('data', function(data) {
      get('http://localhost:4001/', function(text) {
        expect(text.match(/apples/)).toBeTruthy();
        fs.writeFileSync(tmpFile, '/** a function */function bananas() {}');
        function doGet() {
          get('http://localhost:4001/', function(text) {
            if (text.match(/bananas/)) {
              docProcess.kill();
              done();
            } else {
              setTimeout(doGet, 100);
            }
          });
        }
        doGet();
      });
    });
  },
  timeout
);

test(
  '--watch',
  function(done) {
    var tmpDir = os.tmpdir();
    var a = path.join(tmpDir, '/simple.js');
    var b = path.join(tmpDir, '/required.js');
    fs.writeFileSync(a, 'require("./required")');
    fs.writeFileSync(b, '/** soup */function soup() {}');
    var docProcess = documentation(['serve', a, '--watch']);
    docProcess.stdout.on('data', function(data) {
      get('http://localhost:4001/', function(text) {
        expect(text.match(/soup/)).toBeTruthy();
        fs.writeFileSync(b, '/** nuts */function nuts() {}');
        function doGet() {
          get('http://localhost:4001/', function(text) {
            if (text.match(/nuts/)) {
              docProcess.kill();
              done();
            } else {
              setTimeout(doGet, 100);
            }
          });
        }
        doGet();
      });
    });
  },
  timeout
);

test(
  'error page',
  function(done) {
    var tmpDir = os.tmpdir();
    var a = path.join(tmpDir, '/simple.js');
    fs.writeFileSync(a, '**');
    var docProcess = documentation(['serve', a, '--watch']);
    docProcess.stdout.on('data', function(data) {
      get('http://localhost:4001/', function(text) {
        expect(text.match(/Unexpected token/)).toBeTruthy();
        docProcess.kill();
        done();
      });
    });
  },
  timeout
);
