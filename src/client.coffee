EventEmitter = require("events").EventEmitter
LindaSocketIOClient = require("linda-socket.io").Client
SocketIOClient = require "socket.io-client"
agent = require 'superagent'
_ = require 'lodash'

module.exports = class Client extends EventEmitter

  constructor: (@name, @options={}) ->
    @api = options?.manager || 'http://linda.babascript.org'
    if @options.query?
      @api += "/?"
      for key, value of @options.query
        @api += "#{key}=#{value}&"
    socket = SocketIOClient.connect @api, {'force new connection': true}
    @linda = new LindaSocketIOClient().connect socket
    @tasks = []
    @data = {}
    @setFlag = true
    @loadingModules = []
    @modules = {}
    @id = @getId()
    if @linda.io.socket.open is true
      @connect()
    else
      @linda.io.on "connect", =>
        @connect()
    return @

  connect: =>
    @group = @linda.tuplespace @name
    @next()
    @broadcast()
    @unicast()
    @watchCancel()
    if Object.keys(@modules).length > 0
      for name, module of @modules
        module.body.connect()

  next: ->
    if @tasks.length > 0
      task = @tasks[0]
      format = task.format
      @emit "get_task", task
      @group.write
        baba: 'script'
        type: 'report'
        value: 'taked'
        tuple: task
    else
      @group.take {baba: "script", type: "eval"}, @getTask

  unicast: ->
    t = {baba: "script", type: "unicast", unicast: @id}
    @group.read t, (err, tuple)=>
      @getTask err, tuple
      @group.watch t, @getTask

  broadcast: ->
    t = {baba: "script", type: "broadcast"}
    @group.watch t, @getTask

  watchCancel: (callback) ->
    @group.watch {baba: "script", type: "cancel"}, (err, tuple) =>
      _.each @tasks, (task, i) =>
        if task.cid is tuple.data.cid
          @tasks.splice i, 1
          if i is 0
            @emit "cancel_task", 'cancel'
            @next()

  cancel: ->
    task = @tasks.shift()
    cid = task.cid
    tuple =
      baba: "script"
      type: "cancel"
      cid: cid
    @group.write tuple
    @next()

  returnValue: (value, options={}) ->
    task = @tasks.shift()
    tuple =
      baba: "script"
      type: "return"
      value: value
      cid: task.cid
      worker: options.worker || @name
      options: options
      name: @group.name
      _task: task
    @group.write tuple
    if Object.keys(@modules).length > 0
      for name, module of @modules
        module.body.returnValue tuple
    @next()


  watchAliveCheck: ->
    @group.watch {baba: "script", type: "aliveCheck"}, (err, tuple)=>
      @group.write {baba: "script", alive: true, id: @id}

  getTask: (err, tuple)=>
    return err if err
    @tasks.push tuple.data
    @emit "get_task", tuple.data if @tasks.length > 0
    if Object.keys(@modules).length > 0
      for name, module of @modules
        module.body.receive tuple

  getId: ->
    return "#{Math.random()*10000}_#{Math.random()*10000}"

  set: (name, mod) =>
    @loadingModules.push {name: name, body: mod}
    @__set()

  __set: =>
    if @loadingModules.length is 0
      @next()
    else
      if @setFlag
        @setFlag = false
        mod = @loadingModules.shift()
        name = mod.name
        mod.body.load @, =>
          setTimeout =>
            @modules[name] = mod
            @setFlag = true
            @__set()
          , 100
