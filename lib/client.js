(function() {
  var Client, EventEmitter, LindaSocketIOClient, SocketIOClient, UserAttributes, agent,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("EventEmitter2").EventEmitter2;

  LindaSocketIOClient = require("linda-socket.io").Client;

  SocketIOClient = require("socket.io-client");

  agent = require('superagent');

  UserAttributes = (function(_super) {
    __extends(UserAttributes, _super);

    UserAttributes.prototype.data = {};

    UserAttributes.prototype.isSyncable = false;

    function UserAttributes(linda) {
      this.linda = linda;
      this.sync = __bind(this.sync, this);
      UserAttributes.__super__.constructor.call(this);
    }

    UserAttributes.prototype.get = function(key) {
      if (key == null) {
        return;
      }
      return this.data[key];
    };

    UserAttributes.prototype.__syncStart = function(attr) {
      var key, value, __data, _results;
      if (attr == null) {
        return;
      }
      this.name = attr.username;
      __data = null;
      for (key in attr) {
        value = attr[key];
        if (this.get(key) == null) {
          this.set(key, value);
        } else {
          if (__data == null) {
            __data = {};
          }
          __data[key] = value;
        }
      }
      this.isSyncable = true;
      this.emit("get_data", this.data);
      this.ts = this.linda.tuplespace(this.name);
      this.ts.watch({
        type: 'userdata'
      }, (function(_this) {
        return function(err, result) {
          var username, _ref;
          if (err) {
            return;
          }
          _ref = result.data, key = _ref.key, value = _ref.value, username = _ref.username;
          if (username === _this.name) {
            _this.set(key, value);
            return _this.emit("change_data", _this.data);
          }
        };
      })(this));
      if (__data != null) {
        _results = [];
        for (key in __data) {
          value = __data[key];
          _results.push(this.sync(key, value));
        }
        return _results;
      }
    };

    UserAttributes.prototype.sync = function(key, value) {
      return this.ts.write({
        type: 'userdata-write',
        key: key,
        value: value
      });
    };

    UserAttributes.prototype.set = function(key, value, options) {
      if (options == null) {
        options = {
          sync: false
        };
      }
      if ((key == null) || (value == null)) {
        return;
      }
      if ((options != null ? options.sync : void 0) && this.isSyncable === true) {
        return this.sync(key, value);
      } else {
        return this.data[key] = value;
      }
    };

    return UserAttributes;

  })(EventEmitter);

  Client = (function(_super) {
    __extends(Client, _super);

    function Client(name, options) {
      var socket;
      this.name = name;
      this.options = options != null ? options : {};
      this.getTask = __bind(this.getTask, this);
      this._connect = __bind(this._connect, this);
      this.connect = __bind(this.connect, this);
      this.api = (options != null ? options.manager : void 0) || 'http://linda.babascript.org';
      socket = SocketIOClient.connect(this.api, {
        'force new connection': true
      });
      this.linda = new LindaSocketIOClient().connect(socket);
      this.linda.io.once("connect", this.connect);
      this.tasks = [];
      this.attributes = new UserAttributes(this.linda);
      this.id = this.getId();
      return this;
    }

    Client.prototype.connect = function() {
      var host, port, _ref, _ref1;
      if (((_ref = this.options) != null ? _ref.manager : void 0) == null) {
        return this._connect();
      } else {
        _ref1 = this.linda.io.socket.options, host = _ref1.host, port = _ref1.port;
        if (this.options.manager) {
          return agent.get("" + host + ":" + port + "/api/user/" + this.name).end((function(_this) {
            return function(err, res) {
              var data;
              if ((res != null ? res.statusCode : void 0) === 200) {
                data = res.body.data.attribute;
                data['username'] = res.body.data.username;
                _this.attributes.__syncStart(data);
              }
              return _this._connect();
            };
          })(this));
        }
      }
    };

    Client.prototype._connect = function() {
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
        worker: options.worker || this.name,
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
      this.group.write({
        baba: 'script',
        type: 'report',
        value: 'taked',
        tuple: tuple
      });
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
