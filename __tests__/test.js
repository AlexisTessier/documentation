'use strict';

var documentationSchema = require('documentation-schema'),
  validate = require('json-schema'),
  documentation = require('../'),
  outputMarkdown = require('../lib/output/markdown.js'),
  outputMarkdownAST = require('../lib/output/markdown_ast.js'),
  outputHtml = require('../lib/output/html.js'),
  normalize = require('./normalize'),
  glob = require('glob'),
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
    documentation.build([file], { github: true }).then(result => {
      normalize(result);
      expect(result).toMatchSnapshot();

      outputMarkdown(result, {}).then(result => {
        expect(result.toString()).toMatchSnapshot();
      });
    });
  });
}

test('document-exported error', function() {
  var file = path.join(__dirname, 'fixture', 'document-exported-bad', 'x.js');
  documentation.build([file], { documentExported: true }).then(
    result => {},
    err => {
      t.match(
        err.message,
        /Unable to find the value x/g,
        'Produces a descriptive error'
      );
    }
  );
});

test('external modules option', function() {
  documentation
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
        documentation
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
        documentation
          .build([file], readOptionsFromFile(file))
          .then(result => outputHtml(result, {}))
          .then(result => {
            var clean = result
              .sort((a, b) => a.path > b.path)
              .filter(r => r.path.match(/(html)$/))
              .map(r => r.contents)
              .join('\n');
            expect(clean).toMatchSnapshot();
          })
          .catch(err => {
            done.fail(err);
          });
      });
    });
});

test('outputs', function() {
  glob
    .sync(path.join(__dirname, 'fixture', '*.input.js'))
    .forEach(function(file) {
      test(path.basename(file), function(tt) {
        documentation.build([file], readOptionsFromFile(file)).then(result => {
          test('markdown', function(t) {
            outputMarkdown(_.cloneDeep(result), { markdownToc: true })
              .then(result => {
                expect(result.toString()).toMatchSnapshot();
              })
              .catch(error => expect(error).toBeFalsy());
          });

          if (file.match(/es6.input.js/)) {
            test('no markdown TOC', function(t) {
              outputMarkdown(_.cloneDeep(result), { markdownToc: false })
                .then(result => {
                  expect(result.toString()).toMatchSnapshot();
                })
                .catch(error => expect(error).toBeFalsy());
            });
          }

          test('markdown AST', function(t) {
            outputMarkdownAST(_.cloneDeep(result), {})
              .then(result => {
                expect(result).toMatchSnapshot();
              })
              .catch(error => expect(error).toBeFalsy());
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

  documentation.build(file, {}).then(result => {
    outputMarkdown(result, hljsConfig).then(result => {
      expect(result.toString()).toMatchSnapshot();
    });
  });
});

test('config', function() {
  var file = path.join(__dirname, 'fixture', 'class.input.js');
  var outputfile = path.join(__dirname, 'fixture', 'class.config.output.md');
  documentation
    .build([file], {
      config: path.join(__dirname, 'fixture', 'simple.config.yml')
    })
    .then(out => outputMarkdown(out, {}))
    .then(md => {
      expect(md).toMatchSnapshot();
    })
    .catch(err => {
      done.fail(err);
    });
});

test('multi-file input', function() {
  documentation
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
  chdir(__dirname, function() {
    documentation.build('test/fixture/simple.input.js', {}).then(data => {
      expect(data.length).toBe(1);
    });
  });
});

test('.lint', function() {
  chdir(__dirname, function() {
    documentation.lint('test/fixture/simple.input.js', {}).then(data => {
      expect(data).toBe('');
    });
  });
});

test('.lint with bad input', function() {
  chdir(__dirname, function() {
    documentation
      .lint('test/fixture/bad/syntax.input', {
        parseExtension: ['input']
      })
      .catch(err => {
        expect(err).toBeTruthy();
      });
  });
});
