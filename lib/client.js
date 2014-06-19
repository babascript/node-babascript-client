(function() {
  var Client, EventEmitter, LindaSocketIOClient, SocketIOClient, agent, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("events").EventEmitter;

  LindaSocketIOClient = require("linda-socket.io").Client;

  SocketIOClient = require("socket.io-client");

  agent = require('superagent');

  _ = require('lodash');

  module.exports = Client = (function(_super) {
    __extends(Client, _super);

    function Client(name, options) {
      var key, socket, value, _ref;
      this.name = name;
      this.options = options != null ? options : {};
      this.__set = __bind(this.__set, this);
      this.set = __bind(this.set, this);
      this.getTask = __bind(this.getTask, this);
      this.connect = __bind(this.connect, this);
      this.api = (options != null ? options.manager : void 0) || 'http://linda.babascript.org';
      if (this.options.query != null) {
        this.api += "/?";
        _ref = this.options.query;
        for (key in _ref) {
          value = _ref[key];
          this.api += "" + key + "=" + value + "&";
        }
      }
      socket = SocketIOClient.connect(this.api, {
        'force new connection': true
      });
      this.linda = new LindaSocketIOClient().connect(socket);
      this.tasks = [];
      this.data = {};
      this.setFlag = true;
      this.loadingModules = [];
      this.modules = {};
      this.id = this.getId();
      if (this.linda.io.socket.open === true) {
        this.connect();
      } else {
        this.linda.io.on("connect", (function(_this) {
          return function() {
            return _this.connect();
          };
        })(this));
      }
      return this;
    }

    Client.prototype.connect = function() {
      var module, name, _ref, _results;
      this.group = this.linda.tuplespace(this.name);
      this.next();
      this.broadcast();
      this.unicast();
      this.watchCancel();
      if (Object.keys(this.modules).length > 0) {
        _ref = this.modules;
        _results = [];
        for (name in _ref) {
          module = _ref[name];
          _results.push(module.body.connect());
        }
        return _results;
      }
    };

    Client.prototype.next = function() {
      var format, task;
      if (this.tasks.length > 0) {
        task = this.tasks[0];
        format = task.format;
        this.emit("get_task", task);
        return this.group.write({
          baba: 'script',
          type: 'report',
          value: 'taked',
          tuple: task
        });
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
      return this.group.watch(t, this.getTask);
    };

    Client.prototype.watchCancel = function(callback) {
      return this.group.watch({
        baba: "script",
        type: "cancel"
      }, (function(_this) {
        return function(err, tuple) {
          return _.each(_this.tasks, function(task, i) {
            if (task.cid === tuple.data.cid) {
              _this.tasks.splice(i, 1);
              if (i === 0) {
                _this.emit("cancel_task", 'cancel');
                return _this.next();
              }
            }
          });
        };
      })(this));
    };

    Client.prototype.cancel = function() {
      var cid, task, tuple;
      task = this.tasks.shift();
      cid = task.cid;
      tuple = {
        baba: "script",
        type: "cancel",
        cid: cid
      };
      this.group.write(tuple);
      return this.next();
    };

    Client.prototype.returnValue = function(value, options) {
      var module, name, task, tuple, _ref;
      if (options == null) {
        options = {};
      }
      task = this.tasks.shift();
      tuple = {
        baba: "script",
        type: "return",
        value: value,
        cid: task.cid,
        worker: options.worker || this.name,
        options: options,
        name: this.group.name,
        _task: task
      };
      this.group.write(tuple);
      if (Object.keys(this.modules).length > 0) {
        _ref = this.modules;
        for (name in _ref) {
          module = _ref[name];
          module.body.returnValue(tuple);
        }
      }
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
      var module, name, _ref, _results;
      if (err) {
        return err;
      }
      this.tasks.push(tuple.data);
      if (this.tasks.length > 0) {
        this.emit("get_task", tuple.data);
      }
      if (Object.keys(this.modules).length > 0) {
        _ref = this.modules;
        _results = [];
        for (name in _ref) {
          module = _ref[name];
          _results.push(module.body.receive(tuple));
        }
        return _results;
      }
    };

    Client.prototype.getId = function() {
      return "" + (Math.random() * 10000) + "_" + (Math.random() * 10000);
    };

    Client.prototype.set = function(name, mod) {
      this.loadingModules.push({
        name: name,
        body: mod
      });
      return this.__set();
    };

    Client.prototype.__set = function() {
      var mod, name;
      if (this.loadingModules.length === 0) {
        return this.next();
      } else {
        if (this.setFlag) {
          this.setFlag = false;
          mod = this.loadingModules.shift();
          name = mod.name;
          return mod.body.load(this, (function(_this) {
            return function() {
              return setTimeout(function() {
                _this.modules[name] = mod;
                _this.setFlag = true;
                return _this.__set();
              }, 100);
            };
          })(this));
        }
      }
    };

    return Client;

  })(EventEmitter);

}).call(this);
