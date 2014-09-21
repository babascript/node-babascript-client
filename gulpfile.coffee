'use strict'

gulp = require 'gulp'
gutil = require 'gulp-util'
mocha = require 'gulp-mocha'
coffee = require 'gulp-coffee'
rename = require 'gulp-rename'
browserify = require 'gulp-browserify'
coffeelint = require 'gulp-coffeelint'
runSequence = require 'run-sequence'
coffeescript = require 'coffee-script'

gulp.task 'coffee', ->
  path = ""
  return gulp.src('src/**/*.coffee')
  .pipe coffee({bare: true}).on 'error', gutil.log
  .pipe gulp.dest('dist/')

gulp.task 'coffeelint', ->
  return gulp.src('src/**/*.coffee')
  .pipe(coffeelint())
  .pipe(coffeelint.reporter())

gulp.task 'mocha', ->
  return gulp.src('tests/**/*.coffee')
  .pipe mocha
    ui: 'bdd'
    reporter: 'spec'
    ignoreLeaks: no
    timeout: 10 * 1000

gulp.task 'browserify', ->
  # TODO 

gulp.task 'compile',['coffee', 'browserify'],  ->


gulp.task 'test', ->
  gulp.watch ['tests/**/*.coffee'], ['coffeelint', 'mocha']

gulp.task 'default', (callback) ->
  runSequence('coffeelint', ['coffee', 'mocha'], callback)