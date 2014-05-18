(function() {
  var Client, EventEmitter, LindaSocketIOClient, SocketIOClient,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("EventEmitter2").EventEmitter2;

  LindaSocketIOClient = require("linda-socket.io").Client;

  SocketIOClient = require("socket.io-client");

  Client = (function(_super) {
    __extends(Client, _super);

    Client.prototype.api = "http://linda.babascript.org";

    function Client(name) {
      var options, socket;
      this.name = name;
      this.getTask = __bind(this.getTask, this);
      this.connect = __bind(this.connect, this);
      options = {
        'force new connection': true
      };
      socket = SocketIOClient.connect(this.api, options);
      this.linda = new LindaSocketIOClient().connect(socket);
      if (!this.linda.io.socket.open) {
        this.linda.io.once("connect", this.connect);
      } else {
        this.connect();
      }
      this.tasks = [];
      this.id = this.getId();
    }

    Client.prototype.connect = function() {
      this.group = this.linda.tuplespace(this.name);
      this.next();
      this.broadcast();
      return this.unicast();
    };

    Client.prototype.next = function() {
      var format, task;
      if (this.tasks.length > 0) {
        task = this.tasks[0];
        format = task.format;
        return this.emit("get_task", task);
      } else {
        return this.group.take({
          baba: "script",
          type: "eval"
        }, this.getTask);
      }
    };

    Client.prototype.unicast = function() {
      var t;
      t = {
        baba: "script",
        type: "unicast",
        unicast: this.id
      };
      return this.group.read(t, (function(_this) {
        return function(err, tuple) {
          _this.getTask(err, tuple);
          return _this.group.watch(t, _this.getTask);
        };
      })(this));
    };

    Client.prototype.broadcast = function() {
      var t;
      t = {
        baba: "script",
        type: "broadcast"
      };
      return this.group.read(t, (function(_this) {
        return function(err, tuple) {
          _this.getTask(err, tuple);
          return _this.group.watch(t, _this.getTask);
        };
      })(this));
    };

    Client.prototype.watchCancel = function(callback) {
      return this.group.watch({
        baba: "script",
        type: "cancel"
      }, function(err, tple) {
        var cancelTasks, task, _i, _len, _results;
        cancelTasks = _.where(this.tasks, {
          cid: tuple.cid
        });
        if (cancelTasks != null) {
          _results = [];
          for (_i = 0, _len = cancelTasks.length; _i < _len; _i++) {
            task = cancelTasks[_i];
            if (task === this.tasks[0]) {
              this.emit("cancel_task", task);
              this.next();
            }
            _results.push(this.tasks.remove(task));
          }
          return _results;
        }
      });
    };

    Client.prototype.doCancel = function() {
      var cid, tuple;
      cid = this.tasks.get("cid");
      tuple = {
        baba: "script",
        type: "cancel",
        cid: cid
      };
      this.tasks.shift();
      return this.group.write(tuple);
    };

    Client.prototype.returnValue = function(value, options) {
      var task, tuple;
      if (options == null) {
        options = {};
      }
      task = this.tasks.shift();
      tuple = {
        baba: "script",
        type: "return",
        value: value,
        cid: task.cid,
        worker: this.name,
        options: options,
        name: this.group.name,
        _task: task
      };
      this.group.write(tuple);
      return this.next();
    };

    Client.prototype.watchAliveCheck = function() {
      return this.group.watch({
        baba: "script",
        type: "aliveCheck"
      }, (function(_this) {
        return function(err, tuple) {
          return _this.group.write({
            baba: "script",
            alive: true,
            id: _this.id
          });
        };
      })(this));
    };

    Client.prototype.getTask = function(err, tuple) {
      if (err) {
        return err;
      }
      this.tasks.push(tuple.data);
      if (this.tasks.length > 0) {
        return this.emit("get_task", tuple.data);
      }
    };

    Client.prototype.getId = function() {
      return "" + (Math.random() * 10000) + "_" + (Math.random() * 10000);
    };

    return Client;

  })(EventEmitter);

  module.exports = Client;

}).call(this);
