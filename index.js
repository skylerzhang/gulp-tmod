'use strict';

var fs = require('fs');
var del = require('del');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var TmodJS = require('tmodjs');
var PluginError = gutil.PluginError;
var File = gutil.File;

var PLUGIN_NAME = 'gulp-tmod';

module.exports = function(opt) {
  var templatePaths = [];

  opt = opt || {};
  opt.delOutput = opt.delOutput === false ? false : true;
  opt.combo = opt.combo === false ? false : true;

  if (typeof opt.templateBase === 'string') {
    opt.templateBase = opt.templateBase;
  } else {
    opt.templateBase = __dirname;
  }

  if (typeof opt.output === 'string') {
    opt.output = path.join(__dirname, opt.output);
  } else {
    opt.output = path.join(__dirname, '.tmp');
  }

  if (typeof opt.comboFilename === 'string') {
    opt.comboFilename = path.basename(opt.comboFilename);
  } else {
    opt.comboFilename = 'template.js';
  }

  var tmodjs = new TmodJS(opt.templateBase, opt);
  var transformFiles = [];
  var hasOnCompile = false;
  var compileCount = 0;

  function transform(file, enc, cb) {
    if (file.isNull()) {
      cb();
      return;
    }

    var templatePath = path.normalize(path.relative(opt.templateBase, file.path));

    if(!opt.combo) {
      if (!hasOnCompile) {
        hasOnCompile = true;
        tmodjs.on('compile', function(error, data) {
          if (error) {
            cb(new gutil.PluginError(PLUGIN_NAME, error));
            return;
          }

          var cfile = transformFiles[compileCount];
          cfile.contents = new Buffer(data.output);
          cfile.path = gutil.replaceExtension(transformFiles[compileCount++].path, '.js');

          this.push(cfile);
          cb();
        }.bind(this));
      }
      transformFiles.push(file);
      tmodjs.compile(templatePath);
    } else {
      templatePaths.push(templatePath);
      cb();
    }
  }

  function flush(cb) {
    if (opt.combo && templatePaths.length) {
      tmodjs.on('combo', function (error, data) {
        if (error) {
          cb(new gutil.PluginError(PLUGIN_NAME, error));
          return;
        }

        var file = new File({
          path: opt.comboFilename,
          contents: new Buffer(data.output)
        });

        this.push(file);
        opt.delOutput && del(opt.output);
        cb();
      }.bind(this));
      tmodjs.compile(templatePaths);
      return;
    }

    opt.delOutput && del(opt.output);
    cb();
  }

  return through.obj(transform, flush);
}
