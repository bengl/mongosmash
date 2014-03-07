'use strict';

var observed = require('observed');

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
  this.observers = []; // hang on to references so we don't lose the observers
}

var proto = MongoSmash.prototype;

proto._handleChanges = function(obj, changes) {
  if (!Array.isArray(changes)) changes = [changes];
  var lists = this.changelists;
  for (var i = 0; i < changes.length; i++) {
    if (!lists.has(obj)) lists.set(obj, [changes[i]]);
    else if (!Array.isArray(lists.get(obj))) lists.set(obj, []);
    else lists.get(obj).push(changes[i]);
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
  observer.on('changed', function(changes){ self._handleChanges(obj, changes) });
  this.observers.push(observer);
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
  setImmediate(function(){ // observe handlers only fire in next tick
    var q = changelistToQuery(self.changelists.get(obj));
    if (q.insert || q.update) model = self.modelnames.get(obj);
    var after = function(err, result){
      if (err) return cb(err);
      self.changelists.delete(obj);
      if (!result) return cb();
      if (typeof result === 'object' && !Array.isArray(result)) {
        self._observe(result, model);
        return cb(null, result);
      }
      if (result.forEach) {
        result = result[0];
        if (typeof result === 'object') self._observe(result, model);
        return cb(null, result);
      }
      if (result.toArray) {
        result.toArray(function(err, results) {
          if (err) return cb(err);
          result = results[0];
          if (typeof result === 'object') self._observe(result, model);
          return cb(null, result);
        });
      }
      return cb(null, result);
    };
    if (q.insert) return self._insert(model, obj, after);
    else if (q.update) return self._update(model, idOf(obj), q.update, after);
    else return after();
  });
};

function changelistToQuery(list) {
  if (list.indexOf('insert') >= 0) return {insert: true};

  var query = {$set:{}, $unset:{}};
  list.forEach(function(change){
    if (change.type == 'new') query.$set[change.path] = change.value;
    if (change.type === 'updated') {
      query.$set[change.path] = change.value;
      if (query.$unset[change.path]) delete query.$unset[change.path];
    }
    if (change.type === 'deleted') {
      query.$unset[change.path] = "";
      if (query.$set[change.path]) delete query.$set[change.path];
    }
  });
  if (!Object.keys(query.$set).length) delete query.$set;
  if (!Object.keys(query.$unset).length) delete query.$unset;
  return {update: query};
}

function idOf(obj) { return {_id: obj._id}; }

module.exports = MongoSmash;
