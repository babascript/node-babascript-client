EventEmitter = require("EventEmitter2").EventEmitter2
LindaSocketIOClient = require("linda-socket.io").Client
SocketIOClient = require "socket.io-client"

class Client extends EventEmitter

  api: "http://linda.babascript.org"

  constructor: (@name, options={}) ->
    api = options.linda || @api
    socket = SocketIOClient.connect api, {'force new connection': true}
    @linda = new LindaSocketIOClient().connect socket
    if !@linda.io.socket.open
      @linda.io.once "connect", @connect
    else
      @connect()
    @tasks = []
    @id = @getId()

  connect: =>
    @group = @linda.tuplespace @name
    @next()
    @broadcast()
    @unicast()

  next: ->
    if @tasks.length > 0
      task = @tasks[0]
      format = task.format
      @emit "get_task", task
    else
      @group.take {baba: "script", type: "eval"}, @getTask

  unicast: ->
    t = {baba: "script", type: "unicast", unicast: @id}
    @group.read t, (err, tuple)=>
      @getTask err, tuple
      @group.watch t, @getTask

  broadcast: ->
    t = {baba: "script", type: "broadcast"}
    # 一度、readしてデータを取得する？

    @group.read t, (err, tuple)=>
      @getTask err, tuple
      @group.watch t, @getTask

  watchCancel: (callback) ->
    @group.watch {baba: "script", type: "cancel"}, (err, tple) ->
      cancelTasks = _.where @tasks, {cid: tuple.cid}
      if cancelTasks?
        for task in cancelTasks
          if task is @tasks[0]
            @emit "cancel_task", task
            @next()
          @tasks.remove task

  doCancel: ->
    cid = @tasks.get "cid"
    tuple =
      baba: "script"
      type: "cancel"
      cid: cid
    @tasks.shift()
    @group.write tuple

  returnValue: (value, options={}) ->
    task = @tasks.shift()
    tuple =
      baba: "script"
      type: "return"
      value: value
      cid: task.cid
      worker: @name
      options: options
      name: @group.name
      _task: task
    @group.write tuple
    @next()

  watchAliveCheck: ->
    @group.watch {baba: "script", type: "aliveCheck"}, (err, tuple)=>
      @group.write {baba: "script", alive: true, id: @id}

  getTask: (err, tuple)=>
    return err if err
    @tasks.push tuple.data
    @emit "get_task", tuple.data if @tasks.length > 0

  getId: ->
    return "#{Math.random()*10000}_#{Math.random()*10000}"

module.exports = Client
