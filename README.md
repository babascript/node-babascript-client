# BabaScript Client

* BabaScript Client は、BabaScriptからの命令を受け取るためのクライアントです。

## initialize

    Client = require "babascript-client"
    client = new Client "name"

## client.on "get_task", callback

    client.on "get_task", (result)->
      # タスクを受け取った時の処理を記述する

* client に get_task という名前でコールバックを登録する
* client が script からの命令を受け取ると、登録されているメソッドが実行される。

## client.returnValue(value)

    client.returnValue true

* returnValue メソッドを用いることで、script側に命令を返すことができる。
* 現在実行中のタスクの返り値

## client.on "cancel_task", callback

    client.on "cancel_task", (task)->
      # タスクがキャンセルされた時の処理を記述する

* script 側の事情で命令がキャンセルされた時、このメソッドが呼ばれる。
