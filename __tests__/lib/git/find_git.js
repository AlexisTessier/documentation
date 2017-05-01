'use strict';

var mock = require('mock-fs'),
  mockRepo = require('./mock_repo'),
  path = require('path'),
  findGit = require('../../../src/git/find_git');

test('findGit', function() {
  mock(mockRepo.master);

  const root = path.parse(__dirname).root;

  expect(
    findGit(root + path.join('my', 'repository', 'path', 'index.js'))
  ).toBe(root + path.join('my', 'repository', 'path', '.git'));

  mock.restore();
});
