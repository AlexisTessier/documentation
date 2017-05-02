/* global jasmine */

var path = require('path'),
  os = require('os'),
  exec = require('child_process').exec,
  tmp = require('tmp'),
  fs = require('fs-extra');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

function documentation(args, options, parseJSON) {
  if (!options) {
    options = {};
  }
  if (!options.cwd) {
    options.cwd = __dirname;
  }

  options.maxBuffer = 1024 * 1024;

  args.unshift('node ' + path.join(__dirname, '..', 'bin', 'documentation.js'));

  return new Promise((resolve, reject) => {
    exec(args.join(' '), options, function(err, stdout, stderr) {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      if (parseJSON === false) {
        resolve(stdout);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

function normalize(result) {
  result.forEach(function(item) {
    item.context.file = '[path]';
  });
  return result;
}

test('documentation binary', function() {
  return documentation(['build fixture/simple.input.js'], {}).then(data => {
    expect(data.length).toBe(1);
  });
});

test('defaults to parsing package.json main', function() {
  return documentation(['build'], {
    cwd: path.join(__dirname, '..')
  }).then(data => {
    expect(data.length).toBeTruthy();
  });
});

test('polyglot mode', function() {
  return documentation([
    'build fixture/polyglot/blend.cpp --polyglot'
  ]).then(data => {
    expect(normalize(data)).toMatchSnapshot();
  });
});

test('accepts config file', function() {
  return documentation([
    'build fixture/sorting/input.js -c fixture/config.json'
  ]).then(data => {
    expect(normalize(data)).toMatchSnapshot();
  });
});

test('accepts config file - reports failures', function() {
  return documentation(
    ['build fixture/sorting/input.js -c fixture/config-bad.yml'],
    {},
    false
  ).catch(stderr => {
    expect(stderr).toMatchSnapshot();
  });
});

test('accepts config file - reports parse failures', function() {
  return documentation(
    ['build fixture/sorting/input.js -c fixture/config-malformed.json'],
    {},
    false
  ).catch(stderr => {
    expect(stderr.stderr.match(/SyntaxError/g)).toBeTruthy();
  });
});

test('--shallow option', function() {
  return documentation([
    'build --shallow fixture/internal.input.js'
  ]).then(data => {
    expect(data.length).toBe(0);
  });
});

test('external modules option', function() {
  return documentation([
    'build fixture/external.input.js ' +
      '--external=external --external=external/node_modules'
  ]).then(data => {
    expect(data.length).toBe(2);
  });
});

test('when a file is specified both in a glob and explicitly, it is only documented once', function() {
  return documentation([
    'build fixture/simple.input.js fixture/simple.input.*'
  ]).then(data => {
    expect(data.length).toBe(1);
  });
});

test('extension option', function() {
  return documentation([
    'build fixture/extension/index.otherextension ' +
      '--requireExtension=otherextension --parseExtension=otherextension'
  ]).then(data => {
    expect(data.length).toBe(1);
  });
});

/*
 * This tests that parseExtension adds extensions to smartGlob's
 * look through directories.
 */
test('polyglot + parseExtension + smartGlob', function() {
  return documentation([
    'build fixture/polyglot ' + '--polyglot --parseExtension=cpp'
  ]).then(data => {
    expect(data.length).toBe(1);
  });
});

test('extension option', function() {
  return documentation(['build fixture/extension.jsx']);
});

test('invalid arguments', function() {
  test('bad -f option', function() {
    return documentation(
      ['build -f DOES-NOT-EXIST fixture/internal.input.js'],
      {},
      false
    ).catch(err => {
      expect(err).toBeTruthy();
    });
  });

  test('html with no destination', function() {
    return documentation(['build -f html fixture/internal.input.js'], function(
      err
    ) {
      expect(
        err
          .toString()
          .match(
            /The HTML output mode requires a destination directory set with -o/
          )
      ).toBeTruthy();
    });
  });

  test('bad command', function() {
    return documentation(
      ['-f html fixture/internal.input.js'],
      {},
      false
    ).catch(err => {
      expect(err.code).toBeTruthy();
    });
  });
});

test('--config', function() {
  var dst = path.join(os.tmpdir(), (Date.now() + Math.random()).toString());
  fs.mkdirSync(dst);
  var outputIndex = path.join(dst, 'index.html');
  var expectedOutputPath = path.join(
    __dirname,
    'fixture/html/nested.config-output.html'
  );
  return documentation(
    [
      'build -c fixture/html/documentation.yml -f html fixture/html/nested.input.js -o ' +
        dst
    ],
    {},
    false
  ).then(() => {
    var output = fs.readFileSync(outputIndex, 'utf8');
    expect(output).toMatchSnapshot();
  });
});

test('--version', function() {
  return documentation(['--version'], {}, false).then(output => {
    expect(output).toBeTruthy();
  });
});

describe('lint command', function() {
  test('generates lint output', function() {
    return documentation(
      ['lint fixture/lint/lint.input.js'],
      {},
      false
    ).catch(err => {
      var data = err.stderr.toString().split('\n').slice(2).join('\n');
      expect(data).toMatchSnapshot();
    });
  });

  test('generates no output on a good file', function() {
    return documentation(
      ['lint fixture/simple.input.js'],
      {},
      false
    ).then(data => {
      expect(data).toBe('');
    });
  });

  test('exposes syntax error on a bad file', function() {
    return documentation(
      ['lint fixture/bad/syntax.input', '--parseExtension input'],
      {},
      false
    ).catch(err => {
      expect(err.code > 0).toBeTruthy();
    });
  });

  test('lint with no inputs', function() {
    return documentation(
      ['lint'],
      {
        cwd: path.join(__dirname, 'fixture/bad')
      },
      false
    ).catch(err => {
      expect(err.code > 0).toBeTruthy();
    });
  });
});

test('given no files', function() {
  return documentation(['build']).catch(err => {
    expect(
      err
        .toString()
        .match(
          /documentation was given no files and was not run in a module directory/
        )
    ).toBeTruthy();
  });
});

test('with an invalid command', function() {
  return documentation(['invalid'], {}, false).catch(err => {
    expect(err).toBeTruthy();
  });
});

test('--access flag', function() {
  return documentation(
    ['build --shallow fixture/internal.input.js -a public'],
    {},
    false
  ).then(data => {
    expect(data).toBe('[]');
  });
});

test('--private flag', function() {
  return documentation(
    ['build fixture/internal.input.js --private'],
    {},
    false
  ).then(data => {
    expect(data.length > 2).toBeTruthy();
  });
});

test('--infer-private flag', function() {
  return documentation(
    ['build fixture/infer-private.input.js --infer-private ^_'],
    {},
    false
  ).then(data => {
    // This uses JSON.parse with a reviver used as a visitor.
    JSON.parse(data, function(n, v) {
      // Make sure we do not see any names that match `^_`.
      if (n === 'name') {
        expect(typeof v).toBe('string');
        expect(!/_$/.test(v)).toBeTruthy();
      }
      return v;
    });
  });
});

test('write to file', function() {
  var dst = path.join(os.tmpdir(), (Date.now() + Math.random()).toString());

  return documentation(
    ['build --shallow fixture/internal.input.js -o ' + dst],
    {},
    false
  ).then(data => {
    expect(data).toBe('');
    expect(fs.existsSync(dst)).toBeTruthy();
  });
});

test('write to html', function() {
  var dstDir = path.join(os.tmpdir(), (Date.now() + Math.random()).toString());
  fs.mkdirSync(dstDir);

  return documentation(
    ['build --shallow fixture/internal.input.js -f html -o ' + dstDir],
    {},
    false
  ).then(data => {
    expect(data).toBe('');
    expect(fs.existsSync(path.join(dstDir, 'index.html'))).toBeTruthy();
  });
});

test('write to html with custom theme', function() {
  var dstDir = path.join(os.tmpdir(), (Date.now() + Math.random()).toString());
  fs.mkdirSync(dstDir);

  return documentation(
    [
      'build -t fixture/custom_theme --shallow fixture/internal.input.js -f html -o ' +
        dstDir
    ],
    {},
    false
  ).then(data => {
    expect(data).toBe('');
    expect(
      fs.readFileSync(path.join(dstDir, 'index.html'), 'utf8')
    ).toBeTruthy();
  });
});

test('write to html, highlightAuto', function() {
  var fixture = 'fixture/auto_lang_hljs/multilanguage.input.js',
    config = 'fixture/auto_lang_hljs/config.yml',
    dstDir = path.join(os.tmpdir(), (Date.now() + Math.random()).toString());

  fs.mkdirSync(dstDir);

  return documentation(
    ['build --shallow ' + fixture + ' -c ' + config + ' -f html -o ' + dstDir],
    {},
    false
  ).then(() => {
    var result = fs.readFileSync(path.join(dstDir, 'index.html'), 'utf8');
    expect(
      result.indexOf('<span class="hljs-number">42</span>') > 0
    ).toBeTruthy();
    expect(
      result.indexOf('<span class="hljs-selector-attr">[data-foo]</span>') > 0
    ).toBeTruthy();
    expect(
      result.indexOf('<span class="hljs-attr">data-foo</span>') > 0
    ).toBeTruthy();
  });
});

test('fatal error', function() {
  return documentation(
    ['build --shallow fixture/bad/syntax.input --parseExtension input'],
    {},
    false
  ).catch(err => {
    expect(err.toString().match(/Unexpected token/)).toBeTruthy();
  });
});

test('build --document-exported', function() {
  return documentation(
    ['build fixture/document-exported.input.js --document-exported -f md'],
    {},
    false
  ).then(data => {
    expect(data).toMatchSnapshot();
  });
});

test('build large file without error (no deoptimized styling error)', function() {
  var dstFile =
    path.join(os.tmpdir(), (Date.now() + Math.random()).toString()) + '.js';
  var contents = '';
  for (var i = 0; i < 4e4; i++) {
    contents += '/* - */\n';
  }
  fs.writeFileSync(dstFile, contents, 'utf8');

  return documentation(['build ' + dstFile], {}, false).then(() => {
    fs.unlinkSync(dstFile);
  });
});
