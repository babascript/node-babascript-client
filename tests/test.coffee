process.env.NODE_ENV = "test"

path = require "path"
assert = require "assert"
Babascript = require "babascript"
Client = require path.resolve "dist/client"
_    = require "lodash"

describe "client test", ->

  it "valid initialize", (done) ->
    baba = new Babascript "baba"
    assert.notEqual baba, null
    done()

  it "valid namespace", (done) ->
    space = "__baba_namespace"
    baba = new Babascript space
    assert.equal baba.id, space
    done()

  it "baba constructor's arguments[length-1,2] is function", (done) ->
    space = "__baba_constructor_event"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", (result) ->
      @returnValue true
    client.on "cancel_task", (task) ->
      console.log "task"
    baba.引数最後二つはコールバック関数でも良い {format: "boolean"}, (result) ->
      done()

  it "baba should implement callback event", (done) ->
    space = "__baba_add_event"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", (task) ->
      @returnValue true
    client.on "cancel_task", (task) ->
      console.log "cancel_task"
    baba.くらいあんとにこーるばっくいべんと {format: "boolean"}, (result) ->
      assert.equal result.value, true
      done()

  it "return value should be boolean", (done) ->
    space = "__baba_boolean"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", ->
      @returnValue true
    client.on "cancel_task", ->
      console.log cancel
    baba.ぶーりあんをください {format: "boolean"}, (result) ->
      assert.equal result.value, true
      assert.equal typeof result.value, typeof true
      done()

  it "should multiple task", (done) ->
    space = "__baba_multiple_task"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", (result) ->
      @returnValue true
    baba.いっこめ {format: "boolean"}, (r) ->
      assert.equal r.value , true
      baba.にこめ {format: "boolean"}, (r) ->
        assert.equal r.value , true
        baba.さんこめ {format: "boolean"}, (r) ->
          assert.equal r.value , true
          baba.よんこめ {format: "boolean"}, (r) ->
            assert.equal r.value , true
            done()

  it "sequential return value", (done) ->
    space = "__user/baba/seq"
    baba = new Babascript space
    count = 0
    ids = []
    clients = []
    for i in [0..9]
      client = new Client space
      client.on "get_task", (result) ->
        @returnValue true
      clients.push client
    baba.しーくえんしゃる {format: "boolean"}, (result) ->
      isExist = _.find ids, (id) ->
        return id is result.getWorker().id
      assert.equal isExist, undefined
      ids.push result.worker
      count += 1
      if count > 10
        done()
      else
        baba.しーくえんしゃる {format: "boolean"}, arguments.callee


  it "return value should be string", (done) ->
    space = "__baba_string"
    name = "baba"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", ->
      @returnValue name
    baba.すとりんぐをください {format: "string"}, (result) ->
      assert.equal result.value, name
      assert.equal typeof result.value, typeof name
      done()

  it "return value should be number", (done) ->
    space = "__baba_number"
    number = 10
    baba = new Babascript space
    client = new Client space
    client.on "get_task", ->
      @returnValue number
    baba.なんばーをください {format: "number"}, (result) ->
      assert.equal result.value, number
      assert.equal typeof result.value, typeof number
      done()

  it "broadcast task", (done) ->
    space = "__baba_broadcast"
    num = 3
    clients = []
    baba = new Babascript space
    for i in [0..num-1]
      c = new Client space
      c.on "get_task", (result) ->
        @returnValue true
      clients.push c
    setTimeout ->
      baba.ぶろーどきゃすと {format: "boolean", broadcast: num}, (result) ->
        # assert.equal num, result.length
        done()
    , 3000

  it "single result.worker", (done) ->

    space = "__baba_result_worker"
    baba = new Babascript space
    client = new Client space
    client.on "get_task", (tuple) ->
      @returnValue true
    baba.りざるとどっとわーかー {format: "boolean"}, (result) ->
      assert.notEqual result.getWorker(), null
      result.getWorker().つづき {format: "boolean"}, (result) ->
        assert.notEqual result.getWorker(), null
        done()

  it "multi result.worker", (done) ->
    space = "__baba_multi_result_worker"
    num = 3
    clients = []
    baba = new Babascript space
    for i in [0..num-1]
      c = new Client space
      c.on "get_task", (tuple) ->
        @returnValue true
      clients.push c
    setTimeout ->
      baba.まるちなりざるとどっとわーかー {format: "boolean", broadcast: num}, (result) ->
        r = _.sample result
        id = r.getWorker().id
        # これのthis は何？
        # r.getWorker().on "get_task", (result) ->
        #   assert.equal result.worker.id, id
        #   done()
        r.getWorker().てすと {format: "boolean"}, (result) ->
          assert.equal result.getWorker().id, id
          done()
    , 1000

  it "multi player", (done) ->
    space_baba = "__baba_multi_player_baba"
    space_yamada = "__baba_multi_player_yamada"
    baba = new Babascript space_baba
    yamada = new Babascript space_yamada

    clientBaba = new Client space_baba
    clientBaba.on "get_task", ->
      @returnValue "baba"

    clientaYamada = new Client space_yamada
    clientaYamada.on "get_task", ->
      @returnValue "yamada"

    baba.ばばさん (result) ->
      assert.equal result.value, "baba"
      yamada.やまだくん (result) ->
        assert.equal result.value, "yamada"
        done()
