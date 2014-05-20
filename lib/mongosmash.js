'use strict';

var observed = require('observed');
var queryGenerator = require('./queryGenerator');

function NeDBWrapper(nedb) {
  this._dbs = {};
  this.collection = function(name) {
    if (this._dbs[name]) return this._dbs[name];

    this._dbs[name] = new nedb();
    return this._dbs[name];
  };
}

function MongoSmash(db) {
  if (!(this instanceof MongoSmash)) return new MongoSmash(db);
  if (!db) throw Error('An NeDB or MongoDB connection is required!');

  this.isNeDB = typeof db.collection !== 'function';
  this.db = (this.isNeDB ? new NeDBWrapper(db) : db);
  this.changelists = new Map();
  this.modelnames = new Map();
  this.observers = new Map(); // hang on to references so we don't lose the observers
}

var proto = MongoSmash.prototype;

proto._handleChanges = function(obj, changes) {
  if (!Array.isArray(changes)) changes = [changes];
  var lists = this.changelists;
  for (var i = 0; i < changes.length; i++) {
    if (!lists.has(obj)) lists.set(obj, [changes[i]]);
    else if (!Array.isArray(lists.get(obj))) lists.set(obj, []);
    else {
      var list = lists.get(obj);
      if (list.indexOf(changes[i]) === -1)
        list.push(changes[i]);
    }
  }
};

['insert', 'update', 'remove', 'find', 'findOne'].forEach(function(op){
  proto['_'+op] = function(model) { return this._dbOp(model, op, arguments); };
});

proto._dbOp = function(model, op, args) {
  args = [].slice.call(args, 1);
  var col = this.db.collection(model);
  return col[op].apply(col, args);
}

proto._observe = function(obj, model) {
  var self = this;
  this.modelnames.set(obj, model);
  var observer = observed(obj);
  observer.on('change', function(changes){ self._handleChanges(obj, changes) });
  var oldObserver = this.observers.get(obj);
  if (oldObserver) oldObserver.stop();
  this.observers.set(obj, observer);
};

proto.find = function(model, query, cb) {
  var self = this;
  return this._find(model, query, function(err, results){
    if (err) return cb(err);
    if (results.forEach) {
      results.forEach(function(obj) { self._observe(obj, model); });
      return cb(null, results);
    } else {
      results.toArray(function(err, results){
        if (err) return cb(err);
        results.forEach(function(obj) { self._observe(obj, model); });
        return cb(null, results);
      });
    }
  });
};

proto.findOne = function(model, query, cb) {
  var self = this;
  return this._findOne(model, query, function(err, result) {
    if (err) return cb(err);
    if (result) self._observe(result, model);
    cb(null, result);
  });
}

proto.new = function(model, obj) {
  this.changelists.set(obj, ['insert']);
  this._observe(obj, model);
};

proto.create = function(model, obj, cb) {
  this.new(model, obj);
  return this.save(obj, cb);
};

proto.delete = function(obj, cb) {
  var self = this;
  var paramTwo = this.isNeDB ? {} : true;
  return this._remove(this.modelnames.get(obj), idOf(obj), paramTwo, function(err){
    if (err) return cb(err);
    self.changelists.set(obj, []);
    return cb();
  });
};

proto.save = function(obj, cb) {
  var self = this, model;
  function observeAndReturn(result, q) {
    if (!q.insert && typeof result === 'object') // insert returns same object back. i.e. already observed
      self._observe(result, model);
    return cb(null, result);
  }
  this.observers.get(obj).deliverChanges();
  var q = queryGenerator(self.changelists.get(obj), self);
  if (q.insert || q.update) model = self.modelnames.get(obj);
  function after(err, result){
    if (err) return cb(err);
    self.changelists.delete(obj);
    if (!result) return cb();
    if (typeof result === 'object') {
      if (!Array.isArray(result)) {
        if (result.toArray){
          result.toArray(function(err, results) {
            if (err) return cb(err);
            return observeAndReturn(result[0], q);
          });
        }
        return observeAndReturn(result, q);
      } else if (Array.isArray(result)) {
        return observeAndReturn(result[0], q);
      }
    }
    return cb(null, result);
  };
  if (q.insert) return self._insert(model, obj, after);
  else if (q.update) return self._update(model, idOf(obj), q.update, after);
  else return after();
};

function idOf(obj) { return {_id: obj._id}; }

module.exports = MongoSmash;
