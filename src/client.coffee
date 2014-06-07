EventEmitter = require("EventEmitter2").EventEmitter2
LindaSocketIOClient = require("linda-socket.io").Client
SocketIOClient = require "socket.io-client"
agent = require 'superagent'

class UserAttributes extends EventEmitter
  data: {}
  isSyncable: false
  constructor: (@linda) ->
    super()

  get: (key) ->
    return if !key?
    return @data[key]

  __syncStart: (attr) ->
    return if !attr?
    @name = attr.username
    __data = null
    for key, value of attr
      if !@get(key)?
        @set key, value
      else
        __data = {} if !__data?
        __data[key] = value
    @isSyncable = true
    @emit "get_data", @data
    @ts = @linda.tuplespace(@name)
    @ts.watch {type: 'userdata'}, (err, result) =>
      return if err
      {key, value, username} = result.data
      if username is @name
        @set key, value
        @emit "change_data", @data
    if __data?
      for key, value of __data
        @sync key, value

  sync: (key, value) =>
    @ts.write {type: 'userdata-write', key: key, value: value}

  set: (key, value, options={sync: false}) ->
    return if !key? or !value?
    if options?.sync and @isSyncable is true
      @sync key, value
    else
      @data[key] = value


class Client extends EventEmitter

  constructor: (@name, @options={}) ->
    @api = options?.manager || 'http://linda.babascript.org'
    socket = SocketIOClient.connect @api , {'force new connection': true}
    @linda = new LindaSocketIOClient().connect socket
    @linda.io.once "connect", @connect
    @tasks = []
    @attributes = new UserAttributes @linda
    @id = @getId()
    return @

  connect: =>
    if !@options?.manager?
      @_connect()
    else
      {host, port} = @linda.io.socket.options
      if @options.manager
        agent.get("#{host}:#{port}/api/user/#{@name}").end (err, res) =>
          if res?.statusCode is 200
            data = res.body.data.attribute
            data['username'] = res.body.data.username
            @attributes.__syncStart data
          @_connect()

  _connect: =>
    @group = @linda.tuplespace @name
    @next()
    @broadcast()
    @unicast()

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
      worker: options.worker || @name
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
    @group.write {baba: 'script', type: 'report', value: 'taked', tuple: tuple}
    @tasks.push tuple.data
    @emit "get_task", tuple.data if @tasks.length > 0

  getId: ->
    return "#{Math.random()*10000}_#{Math.random()*10000}"


module.exports = Client
