'use strict';
var path = require('path'),
  os = require('os'),
  exec = require('child_process').exec,
  tmp = require('tmp'),
  fs = require('fs-extra');

function documentation(args, options, parseJSON) {
  return new Promise((resolve, reject) => {
    if (!options.cwd) {
      options.cwd = __dirname;
    }

    options.maxBuffer = 1024 * 1024;

    args.unshift(
      'node ' + path.join(__dirname, '..', 'bin', 'documentation.js')
    );

    exec(args.join(' '), options, (err, res) => {
      resolve(res);
    });
  });
}

var UPDATE = !!process.env.UPDATE;

describe('readme command', function() {
  var fixtures = path.join(__dirname, 'fixture/readme');
  var sourceFile = path.join(fixtures, 'index.js');
  var d;
  var removeCallback;

  beforeEach(() => {
    var dirEntry = tmp.dirSync({ unsafeCleanup: true });
    d = dirEntry.name;
    fs.copySync(
      path.join(fixtures, 'README.input.md'),
      path.join(d, 'README.md')
    );
    fs.copySync(path.join(fixtures, 'index.js'), path.join(d, 'index.js'));
  });

  // run tests after setting up temp dir

  test('--diff-only: changes needed', function() {
    var before = fs.readFileSync(path.join(d, 'README.md'), 'utf-8');
    return documentation(['readme index.js --diff-only -s API'], {
      cwd: d
    }).catch(err => {
      var after = fs.readFileSync(path.join(d, 'README.md'), 'utf-8');
      expect(err).toBeTruthy();
      expect(err.code).not.toBe(0);
      expect(after).toEqual(before);
    });
  });

  var expectedFile = path.join(fixtures, 'README.output.md');
  var expectedPath = path.join(fixtures, 'README.output.md');
  var expected = fs.readFileSync(expectedFile, 'utf-8');

  test('updates README.md', function() {
    return documentation(['readme index.js -s API'], { cwd: d }).then(() => {
      var outputPath = path.join(d, 'README.md');

      if (UPDATE) {
        fs.writeFileSync(expectedPath, fs.readFileSync(outputPath, 'utf-8'));
      }

      var actual = fs.readFileSync(outputPath, 'utf-8');
      expect(actual).toEqual(expected);
    });
  });

  test('--readme-file', function() {
    fs.copySync(
      path.join(fixtures, 'README.input.md'),
      path.join(d, 'other.md')
    );
    return documentation(['readme index.js -s API --readme-file other.md'], {
      cwd: d
    }).then(() => {
      var actualPath = path.join(d, 'other.md');
      if (UPDATE) {
        fs.writeFileSync(actualPath, expected);
      }
      var actual = fs.readFileSync(actualPath, 'utf-8');
      expect(actual).toEqual(expected);
    });
  });

  test('--diff-only: changes NOT needed', function() {
    fs.copySync(
      path.join(fixtures, 'README.output.md'),
      path.join(d, 'uptodate.md')
    );
    return documentation(
      ['readme index.js --diff-only -s API --readme-file uptodate.md'],
      { cwd: d }
    ).then(stdout => {
      // t.match(stdout, 'is up to date.');
    });
  });

  test('-s: not found', function() {
    fs.copySync(
      path.join(fixtures, 'README.output.md'),
      path.join(d, 'uptodate.md')
    );
    return documentation(
      ['readme index.js --diff-only -s NOTFOUND --readme-file uptodate.md'],
      { cwd: d }
    ).catch(err => {
      expect(err).toBeTruthy();
    });
  });

  test('requires -s option', function() {
    return documentation(['readme index.js'], { cwd: d }).catch(err => {
      expect(err).toBeTruthy();
      expect(err.code !== 0).toBeTruthy();
      expect(stderr.match(/Missing required argument/)).toBeTruthy();
    });
  });

  var badFixturePath = path.join(__dirname, 'fixture/bad/syntax.input');
  test('errors on invalid syntax', function() {
    return documentation(
      ['readme ' + badFixturePath + ' -s API --parseExtension input'],
      { cwd: d }
    ).catch(err => {
      expect(err).toBeTruthy();
      expect(err.code !== 0).toBeTruthy();
    });
  });
});
