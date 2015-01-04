Backbone = require('backbone')

class Task extends Backbone.Model
  defaults:
    interrupt: false

  initialize: (data, option={interrupt: false}) ->
    for k,v of data
      @set k, v
    if option.interrupt is true
      @set 'interrupt', true

class Tasks extends Backbone.Collection
  model: Task

module.exports =
  Task: Task
  Tasks: Tasks
