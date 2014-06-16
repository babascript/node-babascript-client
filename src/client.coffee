EventEmitter = require("events").EventEmitter
LindaSocketIOClient = require("linda-socket.io").Client
SocketIOClient = require "socket.io-client"
agent = require 'superagent'
_ = require 'lodash'

class UserAttributes extends EventEmitter
  data: {}
  isSyncable: false
  constructor: (@linda) ->
    super()

  get: (key) ->
    return if !key?
    return @data[key]

  __syncStart: (_data) ->
    return if !_data?
    @name = _data.username
    __data = null
    for key, value of _data.attribute
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
        v = @get key
        if v isnt value
          @set key, value, {sync: false}
          @emit "change_data", @data
    if __data?
      for key, value of __data
        @sync key, value

  sync: (key, value) =>
    @ts.write {type: 'update', key: key, value: value}

  set: (key, value, options={sync: false}) ->
    return if !key? or !value?
    if options?.sync and @isSyncable is true
      if @get(key) isnt value
        @sync key, value
    else
      @data[key] = value


class Client extends EventEmitter

  constructor: (@name, @options={}) ->
    @api = options?.manager || 'http://linda.babascript.org'
    if @options.query?
      @api += "/?"
      for key, value of @options.query
        @api += "#{key}=#{value}&"
    socket = SocketIOClient.connect @api, {'force new connection': true}
    @linda = new LindaSocketIOClient().connect socket
    @tasks = []
    @attributes = new UserAttributes @linda
    @id = @getId()
    if @linda.io.socket.open is true
      @connect()
    else
      @linda.io.on "connect", =>
        @connect()
    return @

  connect: =>
    if !@options?.manager?
      @_connect()
    else
      {host, port} = @linda.io.socket.options
      if @options.manager
        agent.get("#{host}:#{port}/api/user/#{@name}").end (err, res) =>
          if res?.statusCode is 200
            data =
              username: res.body.username
              attribute: res.body.attribute
            @attributes.__syncStart data
          @_connect()

  _connect: =>
    @group = @linda.tuplespace @name
    @next()
    @broadcast()
    @unicast()
    @watchCancel()

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
    cid = ""
    timeoutId = setTimeout =>
      @group.cancel cid
      @group.watch t, @getTask
    , 2000
    cid = @group.read t, (err, tuple) =>
      return if err
      clearInterval timeoutId
      @getTask err, tuple
      @group.watch t, @getTask

  watchCancel: (callback) ->
    @group.watch {baba: "script", type: "cancel"}, (err, tuple) =>
      _.each @tasks, (task, i) =>
        if task.cid is tuple.data.cid
          @tasks.splice i, 1
          if i is 0
            @emit "cancel_task", 'cancel'
            @next()

  doCancel: ->
    task = @tasks.shift()
    cid = task.get "cid"
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


if window?
  window.BabascriptClient = Client
else if module?.exports?
  module.exports = Client
