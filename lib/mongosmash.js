'use strict';

var observed = require('observed');
var queryGenerator = require('./queryGenerator');
var Promise = require('bluebird');

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
  this.collections = {};
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
  args = Array.prototype.slice.call(args, 1);
  var col;
  if (!this.collections[model]) {
    col = Promise.promisifyAll(this.db.collection(model));
    this.collections[model] = col;
  } else {
    col = this.collections[model];
  }
  return col[op+'Async'].apply(col, args);
}

proto._observe = function(obj, model) {
  var self = this;
  this.modelnames.set(obj, model);
  var observer = observed(obj);
  observer.on('change', function(changes){ self._handleChanges(obj, changes) });
  var oldObserver = this.observers.get(obj);
  if (oldObserver) oldObserver.stop();
  this.observers.set(obj, observer);
  return obj;
};

proto._observeResults = function(model) {
  var self = this;
  return function(results){
    if (!results) return results;
    if (Array.isArray(results))
      return results.map(self._observeResults(model));
    else if (results.toArray)
      return Promise.promisify(results.toArray, results)().then(self._observeResults(model));
    else
      return self._observe(results, model);
  };
};

proto.find = function(model, query, cb) {
  return this._find(model, query).then(this._observeResults(model)).nodeify(cb);
};

proto.findOne = function(model, query, cb) {
  return this._findOne(model, query).then(this._observeResults(model)).nodeify(cb);
}

proto.new = function(model, obj) {
  this.changelists.set(obj, ['insert']);
  this._observe(obj, model);
};

proto.create = function(model, obj, cb) {
  this.new(model, obj);
  return this.save(obj).nodeify(cb);
};

proto.delete = function(obj, cb) {
  var self = this;
  var paramTwo = this.isNeDB ? {} : true;
  return this._remove(this.modelnames.get(obj), idOf(obj), paramTwo)
  .then(function(){
    self.changelists.set(obj, []);
  }).nodeify(cb);
};

proto.save = function(obj, cb) {
  var self = this, model;
  function observeAndReturn(result, q) {
    if (!q.insert && typeof result === 'object') // insert returns same object back. i.e. already observed
      self._observe(result, model);
    return result;
  }
  this.observers.get(obj).deliverChanges();
  var q = queryGenerator(self.changelists.get(obj), self);
  if (q.insert || q.update) model = self.modelnames.get(obj);
  function after(result){
    self.changelists.delete(obj);
    if (!result) return;
    if (typeof result === 'object') {
      if (!Array.isArray(result)) {
        if (result.toArray){
          return Promise.promisify(result.toArray, result)()
          .then(function(results) {
            return observeAndReturn(result[0], q);
          });
        }
        return observeAndReturn(result, q);
      } else if (Array.isArray(result)) {
        return observeAndReturn(result[0], q);
      }
    }
    return result;
  };
  return (
    q.insert ? self._insert(model, obj) :
    q.update ? self._update(model, idOf(obj), q.update) :
    Promise.resolve()
  ).then(after).nodeify(cb);
};

function idOf(obj) { return {_id: obj._id}; }

module.exports = MongoSmash;
