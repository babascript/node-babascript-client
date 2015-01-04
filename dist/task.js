(function() {
  var Backbone, Task, Tasks,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Backbone = require('backbone');

  Task = (function(_super) {
    __extends(Task, _super);

    function Task() {
      return Task.__super__.constructor.apply(this, arguments);
    }

    Task.prototype.defaults = {
      interrupt: false
    };

    Task.prototype.initialize = function(data, option) {
      var k, v;
      if (option == null) {
        option = {
          interrupt: false
        };
      }
      for (k in data) {
        v = data[k];
        this.set(k, v);
      }
      if (option.interrupt === true) {
        return this.set('interrupt', true);
      }
    };

    return Task;

  })(Backbone.Model);

  Tasks = (function(_super) {
    __extends(Tasks, _super);

    function Tasks() {
      return Tasks.__super__.constructor.apply(this, arguments);
    }

    Tasks.prototype.model = Task;

    return Tasks;

  })(Backbone.Collection);

  module.exports = {
    Task: Task,
    Tasks: Tasks
  };

}).call(this);
