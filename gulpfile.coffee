'use strict'

gulp = require 'gulp'
coffee = require 'gulp-coffee'
coffeelint = require 'gulp-coffeelint'
coffeescript = require 'coffee-script'
runSequence = require 'run-sequence'
browserify = require 'gulp-browserify'
rename = require 'gulp-rename'
gutil = require 'gulp-util'
mocha = require 'gulp-mocha'


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
  # そのうちやる

gulp.task 'serve', ->
  gulp.watch ['src/**/*.coffee'], ['coffeelint', 'coffee']

gulp.task 'test', ->
  gulp.watch ['tests/**/*.coffee'], ['mocha']

gulp.task 'default', (callback) ->
  runSequence('coffeelint', ['coffee', 'mocha'], callback)