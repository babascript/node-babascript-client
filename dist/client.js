(function() {
  'use strict';
  var Client, EventEmitter, LindaAdapter, StreamClient, Task, Tasks, _, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("events").EventEmitter;

  LindaAdapter = require('babascript-linda-adapter');

  _ref = require('./task'), Task = _ref.Task, Tasks = _ref.Tasks;

  _ = require('lodash');

  StreamClient = (function(_super) {
    __extends(StreamClient, _super);

    function StreamClient(id, options) {
      this.id = id;
      this.options = options != null ? options : {};
      this.__set = __bind(this.__set, this);
      this.set = __bind(this.set, this);
      if (this.options.adapter != null) {
        this.adapter = this.options.adapter;
      } else {
        this.adapter = new LindaAdapter(this.address, {
          port: 80
        });
      }
      this.adapter.attach(this);
      this.tasks = new Tasks();
      this.data = {};
      this.loadingPlugins = [];
      this.plugins = {};
      this.clientId = this.getId();
      this.on("connect", this.connect);
    }

    StreamClient.prototype.connect = function() {
      this.stream();
      return this.cancelStream();
    };

    StreamClient.prototype.stream = function() {
      return this.adapter.stream((function(_this) {
        return function(err, tuple) {
          if (err) {
            throw err;
          }
          if (tuple.data.type === 'eval') {
            _this.tasks.push(new Task(tuple.data));
          } else if (tuple.data.type === 'interrupt') {
            _this.tasks.push(new Task(tuple.data, {
              interrupt: true
            }));
          }
          return _this.emit("stream", err, tuple);
        };
      })(this));
    };

    StreamClient.prototype.addDefaultTask = function(tasks) {
      var task, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = tasks.length; _i < _len; _i++) {
        task = tasks[_i];
        this.tasks.push(task);
        _results.push(this.emit('stream', null, task));
      }
      return _results;
    };

    StreamClient.prototype.cancelStream = function() {
      var tuple;
      tuple = {
        baba: 'script',
        type: 'cancel'
      };
      return this.adapter.clientReceive(tuple, (function(_this) {
        return function(err, tuple) {
          var i, t, task, _i, _len, _ref1, _ref2;
          if (err) {
            throw err;
          }
          task = null;
          _ref1 = _this.tasks;
          for (i = _i = 0, _len = _ref1.length; _i < _len; i = ++_i) {
            t = _ref1[i];
            if ((t != null ? (_ref2 = t.data) != null ? _ref2.cid : void 0 : void 0) === tuple.data.cid) {
              task = t;
              _this.tasks.splice(i, 1);
            }
          }
          if (task === null) {
            return false;
          }
          return _this.emit('cancel_task', task);
        };
      })(this));
    };

    StreamClient.prototype.returnValue = function(value, cid, options) {
      var module, name, task, tuple, _ref1, _ref2;
      if (options == null) {
        options = {};
      }
      if (cid === null) {
        return false;
      }
      task = this.tasks.where({
        cid: cid
      })[0];
      if (task == null) {
        return false;
      }
      tuple = {
        baba: "script",
        type: "return",
        value: value,
        cid: cid,
        worker: this.id,
        options: options,
        _task: task
      };
      this.adapter.send(tuple);
      this.tasks.remove(task);
      _ref1 = this.plugins;
      for (name in _ref1) {
        module = _ref1[name];
        if ((_ref2 = module.body) != null) {
          _ref2.returnValue(tuple);
        }
      }
      return this.emit("return_value", tuple);
    };

    StreamClient.prototype.accept = function(cid, callback) {
      return this.adapter.clientReceive({
        type: 'eval',
        cid: cid
      }, callback);
    };

    StreamClient.prototype.cancel = function(cid, reason) {
      var i, t, task, tuple, _i, _len, _ref1;
      task = null;
      console.log(this.tasks);
      _ref1 = this.tasks;
      for (i = _i = 0, _len = _ref1.length; _i < _len; i = ++_i) {
        t = _ref1[i];
        if (t.data.cid === cid) {
          task = t;
          this.tasks.splice(i, 1);
        }
      }
      if (task === null) {
        return false;
      }
      cid = task.cid;
      tuple = {
        baba: "script",
        type: "return",
        cid: cid,
        reason: reason
      };
      this.adapter.send(tuple);
      return this.emit("cancel_task", reason);
    };

    StreamClient.prototype.getId = function() {
      return "" + (Math.random() * 10000) + "_" + (Math.random() * 10000);
    };

    StreamClient.prototype.set = function(name, plugin) {
      this.loadingPlugins.push({
        name: name,
        body: plugin
      });
      return this.__set();
    };

    StreamClient.prototype.__set = function() {
      var name, plugin;
      if (this.loadingPlugins.length === 0) {
        return;
      }
      plugin = this.loadingPlugins.shift();
      name = plugin.name;
      return plugin.body.load(this, (function(_this) {
        return function() {
          _this.plugins[name] = plugin;
          return _this.__set();
        };
      })(this));
    };

    return StreamClient;

  })(EventEmitter);

  Client = (function(_super) {
    __extends(Client, _super);

    Client.address = 'http://babascript-linda.herokuapp.com';

    Client.Stream = StreamClient;

    function Client(id, options) {
      this.id = id;
      this.options = options != null ? options : {};
      this.__set = __bind(this.__set, this);
      this.set = __bind(this.set, this);
      this.getTask = __bind(this.getTask, this);
      this.connect = __bind(this.connect, this);
      if (this.options.adapter != null) {
        this.adapter = this.options.adapter;
      } else {
        this.adapter = new LindaAdapter(this.address, {
          port: 80
        });
      }
      this.adapter.attach(this);
      this.tasks = [];
      this.data = {};
      this.loadingPlugins = [];
      this.plugins = {};
      this.clientId = this.getId();
      this.on("connect", this.connect);
      this.isNormalTask = false;
      this.isInterruptTask = false;
      return this;
    }

    Client.prototype.connect = function() {
      var module, name, _ref1, _ref2;
      this.getBroadcast();
      this.watchCancel();
      _ref1 = this.plugins;
      for (name in _ref1) {
        module = _ref1[name];
        if ((_ref2 = module.body) != null) {
          _ref2.connect();
        }
      }
      return this.next();
    };

    Client.prototype.next = function() {
      var format, task, tuple;
      if (this.tasks.length > 0) {
        task = this.tasks[0];
        format = task.format;
        this.emit("get_task", task);
      }
      if (!this.isNormalTask) {
        tuple = {
          baba: 'script',
          type: 'eval'
        };
        this.adapter.clientReceive(tuple, this.getTask);
        this.isNormalTask = true;
      }
      if (!this.isInterruptTask) {
        tuple = {
          baba: 'script',
          type: 'interrupt'
        };
        this.adapter.clientReceive(tuple, this.getTask);
        return this.isInterruptTask = true;
      }
    };

    Client.prototype.getBroadcast = function() {
      var t;
      t = {
        baba: "script",
        type: "broadcast"
      };
      return this.adapter.clientReceive(t, this.getTask);
    };

    Client.prototype.watchCancel = function(callback) {
      var tuple;
      tuple = {
        baba: 'script',
        type: 'cancel'
      };
      return this.adapter.clientReceive(tuple, (function(_this) {
        return function(err, tuple) {
          return _.each(_this.tasks, function(task, i) {
            var reason;
            if (task.cid === tuple.data.cid) {
              _this.tasks.splice(i, 1);
              if (task.type === 'interrupt') {
                _this.isInterruptTask = false;
              } else if (task.type === 'eval') {
                _this.isNormalTask = false;
              }
              if (i === 0) {
                reason = tuple.data.reason || 'cancel';
                _this.emit("cancel_task", {
                  reason: reason
                });
                return _this.next();
              }
            }
          });
        };
      })(this));
    };

    Client.prototype.cancel = function(reason) {
      var cid, task, tuple;
      task = this.tasks.shift();
      cid = task.cid;
      tuple = {
        baba: "script",
        type: "return",
        cid: cid,
        reason: reason
      };
      this.adapter.send(tuple);
      this.emit("cancel_task", reason);
      if (task.type === 'interrupt') {
        this.isInterruptTask = false;
      } else if (task.type === 'eval') {
        this.isNormalTask = false;
      }
      return this.next();
    };

    Client.prototype.returnValue = function(value, options) {
      var module, name, task, tuple, _ref1, _ref2;
      if (options == null) {
        options = {};
      }
      task = this.tasks.shift();
      tuple = {
        baba: "script",
        type: "return",
        value: value,
        cid: task.cid,
        worker: this.id,
        options: options,
        _task: task
      };
      this.adapter.send(tuple);
      _ref1 = this.plugins;
      for (name in _ref1) {
        module = _ref1[name];
        if ((_ref2 = module.body) != null) {
          _ref2.returnValue(tuple);
        }
      }
      this.emit("return_value", tuple);
      if (task.type === 'interrupt') {
        this.isInterruptTask = false;
      } else if (task.type === 'eval') {
        this.isNormalTask = false;
      }
      return this.next();
    };

    Client.prototype.getTask = function(err, tuple) {
      var module, name, __tasks, _ref1, _ref2, _results;
      if (err) {
        return err;
      }
      if (tuple.data.type === 'eval') {
        this.tasks.push(tuple.data);
      } else if (tuple.data.type === 'interrupt') {
        __tasks = [];
        if (this.tasks.length > 0) {
          __tasks.push(this.tasks.shift());
        }
        __tasks.push(tuple.data);
        __tasks.push(this.tasks);
        this.tasks = __tasks;
      }
      if (this.tasks.length > 0) {
        this.emit("get_task", tuple.data);
      }
      _ref1 = this.plugins;
      _results = [];
      for (name in _ref1) {
        module = _ref1[name];
        _results.push((_ref2 = module.body) != null ? _ref2.receive(tuple) : void 0);
      }
      return _results;
    };

    Client.prototype.getId = function() {
      return "" + (Math.random() * 10000) + "_" + (Math.random() * 10000);
    };

    Client.prototype.set = function(name, plugin) {
      this.loadingPlugins.push({
        name: name,
        body: plugin
      });
      return this.__set();
    };

    Client.prototype.__set = function() {
      var name, plugin;
      if (this.loadingPlugins.length === 0) {
        return this.next();
      }
      this.next();
      plugin = this.loadingPlugins.shift();
      name = plugin.name;
      return plugin.body.load(this, (function(_this) {
        return function() {
          _this.plugins[name] = plugin;
          return _this.__set();
        };
      })(this));
    };

    return Client;

  })(EventEmitter);

  module.exports = Client;

}).call(this);
