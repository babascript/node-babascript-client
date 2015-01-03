'use strict'

EventEmitter = require("events").EventEmitter
LindaAdapter = require 'babascript-linda-adapter'
_ = require 'lodash'

class Client extends EventEmitter
  @address = 'http://babascript-linda.herokuapp.com'

  constructor: (@id, @options = {}) ->
    if @options.adapter?
      @adapter = @options.adapter
    else
      @adapter = new LindaAdapter @address, {port: 80}
    @adapter.attach @
    @tasks = []
    @data = {}
    @loadingPlugins = []
    @plugins = {}
    @clientId = @getId()
    @on "connect", @connect
    @isNormalTask = false
    @isInterruptTask = false
    return @

  connect: =>
    @getBroadcast()
    @watchCancel()
    for name, module of @plugins
      module.body?.connect()
    @next()

  next: ->
    if @tasks.length > 0
      task = @tasks[0]
      format = task.format
      @emit "get_task", task
    if !@isNormalTask
      tuple = {baba: 'script', type: 'eval'}
      @adapter.clientReceive tuple, @getTask
      @isNormalTask = true
    if !@isInterruptTask
      tuple = {baba: 'script', type: 'interrupt'}
      @adapter.clientReceive tuple, @getTask
      @isInterruptTask = true

  getBroadcast: ->
    t = {baba: "script", type: "broadcast"}
    @adapter.clientReceive t, @getTask

  watchCancel: (callback) ->
    tuple = {baba: 'script', type: 'cancel'}
    @adapter.clientReceive tuple, (err, tuple) =>
      _.each @tasks, (task, i) =>
        if task.cid is tuple.data.cid
          @tasks.splice i, 1
          if task.type is 'interrupt'
            @isInterruptTask = false
          else if task.type is 'eval'
            @isNormalTask = false
          if i is 0
            reason = tuple.data.reason or 'cancel'
            @emit "cancel_task", {reason: reason}
            @next()

  cancel: (reason) ->
    task = @tasks.shift()
    cid = task.cid
    tuple =
      baba: "script"
      type: "return"
      cid: cid
      reason: reason
    @adapter.send tuple
    @emit "cancel_task", reason
    if task.type is 'interrupt'
      @isInterruptTask = false
    else if task.type is 'eval'
      @isNormalTask = false
    @next()

  returnValue: (value, options={}) ->
    task = @tasks.shift()
    tuple =
      baba: "script"
      type: "return"
      value: value
      cid: task.cid
      worker: @id
      options: options
      _task: task
    @adapter.send tuple
    for name, module of @plugins
      module.body?.returnValue tuple
    @emit "return_value", tuple
    if task.type is 'interrupt'
      @isInterruptTask = false
    else if task.type is 'eval'
      @isNormalTask = false
    @next()

  getTask: (err, tuple) =>
    return err if err
    if tuple.data.type is 'eval'
      @tasks.push tuple.data
    else if tuple.data.type is 'interrupt'
      __tasks = []
      if @tasks.length > 0
        __tasks.push @tasks.shift()
      __tasks.push tuple.data
      __tasks.push @tasks
      @tasks = __tasks
    if @tasks.length > 0
      @emit "get_task", tuple.data
    for name, module of @plugins
      module.body?.receive tuple

  getId: ->
    return "#{Math.random()*10000}_#{Math.random()*10000}"

  set: (name, plugin) =>
    @loadingPlugins.push
      name: name
      body: plugin
    @__set()

  __set: =>
    return @next() if @loadingPlugins.length is 0
    @next()
    plugin = @loadingPlugins.shift()
    name = plugin.name
    plugin.body.load @, =>
      @plugins[name] = plugin
      @__set()

module.exports = Client
