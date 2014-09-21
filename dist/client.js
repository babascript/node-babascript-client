(function() {
  var Client, EventEmitter, LindaAdapter, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("events").EventEmitter;

  LindaAdapter = require('babascript-linda-adapter');

  _ = require('lodash');

  Client = (function(_super) {
    __extends(Client, _super);

    Client.address = '';

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
        this.adapter = new LindaAdapter(Client.address);
      }
      this.adapter.attach(this);
      this.tasks = [];
      this.data = {};
      this.loadingPlugins = [];
      this.plugins = {};
      this.clientId = this.getId();
      this.on("connect", this.connect);
      return this;
    }

    Client.prototype.connect = function() {
      var module, name, _ref, _ref1;
      this.getBroadcast();
      this.watchCancel();
      _ref = this.plugins;
      for (name in _ref) {
        module = _ref[name];
        if ((_ref1 = module.body) != null) {
          _ref1.connect();
        }
      }
      return this.next();
    };

    Client.prototype.next = function() {
      var format, task, tuple;
      if (this.tasks.length > 0) {
        task = this.tasks[0];
        format = task.format;
        return this.emit("get_task", task);
      } else {
        tuple = {
          baba: 'script',
          type: 'eval'
        };
        return this.adapter.clientReceive(tuple, this.getTask);
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
            if (task.cid === tuple.data.cid) {
              _this.tasks.splice(i, 1);
              if (i === 0) {
                _this.emit("cancel_task", {
                  reason: 'cancel'
                });
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
      this.adapter.send(tuple);
      return this.next();
    };

    Client.prototype.returnValue = function(value, options) {
      var module, name, task, tuple, _ref, _ref1;
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
      _ref = this.plugins;
      for (name in _ref) {
        module = _ref[name];
        if ((_ref1 = module.body) != null) {
          _ref1.returnValue(tuple);
        }
      }
      return this.next();
    };

    Client.prototype.getTask = function(err, tuple) {
      var module, name, _ref, _ref1, _results;
      if (err) {
        return err;
      }
      this.tasks.push(tuple.data);
      if (this.tasks.length > 0) {
        this.emit("get_task", tuple.data);
      }
      _ref = this.plugins;
      _results = [];
      for (name in _ref) {
        module = _ref[name];
        _results.push((_ref1 = module.body) != null ? _ref1.receive(tuple) : void 0);
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
