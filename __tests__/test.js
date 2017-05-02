var documentationSchema = require('documentation-schema'),
  validate = require('json-schema'),
  documentation = require('../'),
  outputMarkdown = require('../src/output/markdown.js'),
  outputMarkdownAST = require('../src/output/markdown_ast.js'),
  outputHtml = require('../src/output/html.js'),
  normalize = require('./utils').normalize,
  glob = require('glob'),
  pify = require('pify'),
  path = require('path'),
  fs = require('fs'),
  _ = require('lodash'),
  chdir = require('chdir');

var UPDATE = !!process.env.UPDATE;

function makePOJO(ast) {
  return JSON.parse(JSON.stringify(ast));
}

function readOptionsFromFile(file) {
  var s = fs.readFileSync(file, 'utf-8');
  var lines = s.split(/\n/, 20);
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^\/\/\s+Options:\s*(.+)$/);
    if (m) {
      return JSON.parse(m[1]);
    }
  }
  return {};
}

if (fs.existsSync(path.join(__dirname, '../.git'))) {
  test('git option', function() {
    var file = path.join(__dirname, './fixture/simple.input.js');
    return documentation.build([file], { github: true }).then(result => {
      normalize(result);
      expect(result).toMatchSnapshot();

      return outputMarkdown(result, {}).then(result => {
        expect(result.toString()).toMatchSnapshot();
      });
    });
  });
}

test('document-exported error', function() {
  var file = path.join(__dirname, 'fixture', 'document-exported-bad', 'x.js');
  return documentation.build([file], { documentExported: true }).then(
    result => {},
    err => {
      expect(err.message.match(/Unable to find the value x/g)).toBeTruthy();
    }
  );
});

test('external modules option', function() {
  return documentation
    .build([path.join(__dirname, 'fixture', 'external.input.js')], {
      external: '(external|external/node_modules/*)'
    })
    .then(result => {
      normalize(result);
      var outputfile = path.join(
        __dirname,
        'fixture',
        '_external-deps-included.json'
      );
      expect(result).toMatchSnapshot();
    });
});

test('bad input', function() {
  glob
    .sync(path.join(__dirname, 'fixture/bad', '*.input.js'))
    .forEach(function(file) {
      test(path.basename(file), function(t) {
        return documentation
          .build([file], readOptionsFromFile(file))
          .then(res => {
            expect(res).toBe(undefined);
          })
          .catch(error => {
            // make error a serializable object
            error = JSON.parse(JSON.stringify(error));
            // remove system-specific path
            delete error.filename;
            delete error.codeFrame;
            expect(error).toMatchSnapshot();
          });
      });
    });
});

test('html', function() {
  glob
    .sync(path.join(__dirname, 'fixture/html', '*.input.js'))
    .forEach(function(file) {
      test(path.basename(file), function(t) {
        return documentation
          .build([file], readOptionsFromFile(file))
          .then(result => outputHtml(result, {}))
          .then(result => {
            var clean = result
              .sort((a, b) => a.path > b.path)
              .filter(r => r.path.match(/(html)$/))
              .map(r => r.contents)
              .join('\n');
            expect(clean).toMatchSnapshot();
          });
      });
    });
});

test('outputs', function() {
  glob
    .sync(path.join(__dirname, 'fixture', '*.input.js'))
    .forEach(function(file) {
      test(path.basename(file), function(tt) {
        return documentation
          .build([file], readOptionsFromFile(file))
          .then(result => {
            test('markdown', function(t) {
              return outputMarkdown(_.cloneDeep(result), {
                markdownToc: true
              }).then(result => {
                expect(result.toString()).toMatchSnapshot();
              });
            });

            if (file.match(/es6.input.js/)) {
              test('no markdown TOC', function(t) {
                return outputMarkdown(_.cloneDeep(result), {
                  markdownToc: false
                }).then(result => {
                  expect(result.toString()).toMatchSnapshot();
                });
              });
            }

            test('markdown AST', function(t) {
              return outputMarkdownAST(_.cloneDeep(result), {}).then(result => {
                expect(result).toMatchSnapshot();
              });
            });

            test('JSON', function(t) {
              normalize(result);
              result.forEach(function(comment) {
                validate(
                  comment,
                  documentationSchema.jsonSchema
                ).errors.forEach(function(error) {
                  expect(error).toBeFalsy();
                });
              });
              expect(makePOJO(result)).toMatchSnapshot();
            });
          });
      });
    });
});

test('highlightAuto md output', function() {
  var file = path.join(
    __dirname,
    'fixture/auto_lang_hljs/multilanguage.input.js'
  ),
    hljsConfig = {
      hljs: { highlightAuto: true, languages: ['js', 'css', 'html'] }
    };

  return documentation.build(file, {}).then(result => {
    return outputMarkdown(result, hljsConfig).then(result => {
      expect(result.toString()).toMatchSnapshot();
    });
  });
});

test('config', function() {
  var file = path.join(__dirname, 'fixture', 'class.input.js');
  var outputfile = path.join(__dirname, 'fixture', 'class.config.output.md');
  return documentation
    .build([file], {
      config: path.join(__dirname, 'fixture', 'simple.config.yml')
    })
    .then(out => outputMarkdown(out, {}))
    .then(md => {
      expect(md).toMatchSnapshot();
    });
});

test('multi-file input', function() {
  return documentation
    .build(
      [
        path.join(__dirname, 'fixture', 'simple.input.js'),
        path.join(__dirname, 'fixture', 'simple-two.input.js')
      ],
      {}
    )
    .then(result => {
      normalize(result);
      expect(result).toMatchSnapshot();
    });
});

test('accepts simple relative paths', function() {
  return pify(chdir)(__dirname).then(() => {
    return documentation
      .build('__tests__/fixture/simple.input.js', {})
      .then(data => {
        expect(data.length).toBe(1);
      });
  });
});

test('.lint', function() {
  return pify(chdir)(__dirname).then(() => {
    return documentation
      .lint('__tests__/fixture/simple.input.js', {})
      .then(data => {
        expect(data).toBe('');
      });
  });
});

test('.lint with bad input', function() {
  return pify(chdir)(__dirname).then(() => {
    return documentation
      .lint('__tests__/fixture/bad/syntax.input', {
        parseExtension: ['input']
      })
      .catch(err => {
        expect(err).toBeTruthy();
      });
  });
});
