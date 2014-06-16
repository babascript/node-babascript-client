(function() {
  var Client, EventEmitter, LindaSocketIOClient, SocketIOClient, UserAttributes, agent, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("events").EventEmitter;

  LindaSocketIOClient = require("linda-socket.io").Client;

  SocketIOClient = require("socket.io-client");

  agent = require('superagent');

  _ = require('lodash');

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

    UserAttributes.prototype.__syncStart = function(_data) {
      var key, value, __data, _ref, _results;
      if (_data == null) {
        return;
      }
      this.name = _data.username;
      __data = null;
      _ref = _data.attribute;
      for (key in _ref) {
        value = _ref[key];
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
          var username, v, _ref1;
          if (err) {
            return;
          }
          _ref1 = result.data, key = _ref1.key, value = _ref1.value, username = _ref1.username;
          if (username === _this.name) {
            v = _this.get(key);
            if (v !== value) {
              _this.set(key, value, {
                sync: false
              });
              return _this.emit("change_data", _this.data);
            }
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
        type: 'update',
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
        if (this.get(key) !== value) {
          return this.sync(key, value);
        }
      } else {
        return this.data[key] = value;
      }
    };

    return UserAttributes;

  })(EventEmitter);

  Client = (function(_super) {
    __extends(Client, _super);

    function Client(name, options) {
      var key, socket, value, _ref;
      this.name = name;
      this.options = options != null ? options : {};
      this.getTask = __bind(this.getTask, this);
      this._connect = __bind(this._connect, this);
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
      this.attributes = new UserAttributes(this.linda);
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
                data = {
                  username: res.body.username,
                  attribute: res.body.attribute
                };
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
      this.unicast();
      return this.watchCancel();
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
      var cid, t, timeoutId;
      t = {
        baba: "script",
        type: "broadcast"
      };
      cid = "";
      timeoutId = setTimeout((function(_this) {
        return function() {
          _this.group.cancel(cid);
          return _this.group.watch(t, _this.getTask);
        };
      })(this), 2000);
      return cid = this.group.read(t, (function(_this) {
        return function(err, tuple) {
          if (err) {
            return;
          }
          clearInterval(timeoutId);
          _this.getTask(err, tuple);
          return _this.group.watch(t, _this.getTask);
        };
      })(this));
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

    Client.prototype.doCancel = function() {
      var cid, task, tuple;
      task = this.tasks.shift();
      cid = task.get("cid");
      tuple = {
        baba: "script",
        type: "cancel",
        cid: cid
      };
      this.group.write(tuple);
      return this.next();
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

  if (typeof window !== "undefined" && window !== null) {
    window.BabascriptClient = Client;
  } else if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
    module.exports = Client;
  }

}).call(this);
