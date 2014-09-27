'use strict'

EventEmitter = require("events").EventEmitter
LindaAdapter = require 'babascript-linda-adapter'
_ = require 'lodash'

class Client extends EventEmitter
  @address = ''

  constructor: (@id, @options = {}) ->
    if @options.adapter?
      @adapter = @options.adapter
    else
      @adapter = new LindaAdapter Client.address
    @adapter.attach @
    @tasks = []
    @data = {}
    @loadingPlugins = []
    @plugins = {}
    @clientId = @getId()
    @on "connect", @connect
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
    else
      tuple = {baba: 'script', type: 'eval'}
      @adapter.clientReceive tuple, @getTask

  getBroadcast: ->
    t = {baba: "script", type: "broadcast"}
    @adapter.clientReceive t, @getTask

  watchCancel: (callback) ->
    tuple = {baba: 'script', type: 'cancel'}
    @adapter.clientReceive tuple, (err, tuple) =>
      _.each @tasks, (task, i) =>
        if task.cid is tuple.data.cid
          @tasks.splice i, 1
          if i is 0
            @emit "cancel_task", {reason: 'cancel'}
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
    @next()

  getTask: (err, tuple) =>
    return err if err
    @tasks.push tuple.data
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