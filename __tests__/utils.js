'use strict';
var http = require('http');
var concat = require('concat-stream');

function get(url, callback) {
  return new Promise((resolve, reject) => {
    http.get(url, function(res) {
      res.pipe(
        concat(function(text) {
          if (res.statusCode >= 400) {
            return reject(res.statusCode);
          }
          resolve(text.toString());
        })
      );
    });
  });
}

module.exports.get = get;
