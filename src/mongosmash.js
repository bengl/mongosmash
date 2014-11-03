import observed from 'observed';
import {queryGenerator} from './queryGenerator';

class NeDBWrapper {

  constructor (nedb) {
    this._dbs = {};
    this.nedb = nedb;
  }

  collection (name) {
    if (this._dbs[name]) return this._dbs[name];

    this._dbs[name] = new this.nedb();
    return this._dbs[name];
  }

}

export class MongoSmash {

  constructor (db) {
    if (!(this instanceof MongoSmash)) return new MongoSmash(db);
    if (!db) throw Error('An NeDB or MongoDB connection is required!');

    this.isNeDB = typeof db.collection !== 'function';
    this.db = (this.isNeDB ? new NeDBWrapper(db) : db);
    this.changelists = new Map();
    this.modelnames = new Map();
    this.observers = new Map(); // hang on to references so we don't lose the observers
    this.collections = {};
  }

  _handleChanges (obj, change) {
    let lists = this.changelists;
    if (!lists.has(obj)) lists.set(obj, [change]);
    else lists.get(obj).push(change);
  }

  _dbOp (model, op, args) {
    args = Array.prototype.slice.call(args, 1);
    var col;
    if (!this.collections[model]) {
      col = this.db.collection(model);
      this.collections[model] = col;
    } else {
      col = this.collections[model];
    }
    return new Promise(function(resolve, reject){
      args.push(promisifier(resolve, reject));
      col[op].apply(col, args);
    });
  }

  _observe (obj, model) {
    this.modelnames.set(obj, model);
    let observer = observed(obj);
    observer.on('change', changes => this._handleChanges(obj, changes));
    let oldObserver = this.observers.get(obj);
    if (oldObserver) oldObserver.stop();
    this.observers.set(obj, observer);
    return obj;
  }

  _observeResults (model) {
    return results => {
      if (!results) return results;
      if (Array.isArray(results))
        return results.map(this._observeResults(model));
      else if (results.toArray)
        return toArrayPromise(results).then(this._observeResults(model));
      else
        return this._observe(results, model);
    };
  };

  _insert (model) {
    return this._dbOp(model, 'insert', arguments);
  }

  _update (model) {
    return this._dbOp(model, 'update', arguments);
  }

  _remove (model) {
    return this._dbOp(model, 'remove', arguments);
  }

  _find (model) {
    return this._dbOp(model, 'find', arguments);
  }

  _findOne (model) {
    return this._dbOp(model, 'findOne', arguments);
  }

  find (model, query, cb) {
    return nodeify(this._find(model, query).then(this._observeResults(model)), cb);
  }

  findOne (model, query, cb) {
    return nodeify(this._findOne(model, query).then(this._observeResults(model)), cb);
  }

  new (model, obj) {
    this.changelists.set(obj, ['insert']);
    this._observe(obj, model);
  }

  create (model, obj, cb) {
    this.new(model, obj);
    return nodeify(this.save(obj), cb);
  }

  delete (obj, cb) {
    let paramTwo = this.isNeDB ? {} : true;
    return nodeify(this._remove(this.modelnames.get(obj), idOf(obj), paramTwo)
      .then(() => this.changelists.set(obj, [])), cb);
  }

  save (obj, cb) {
    let model;
    function observeAndReturn(result, q) {
      if (!q.insert && typeof result === 'object') // insert returns same object back. i.e. already observed
        this._observe(result, model);
      return result;
    }
    this.observers.get(obj).deliverChanges();
    let q = queryGenerator(this.changelists.get(obj), this);
    if (q.insert || q.update) model = this.modelnames.get(obj);
    let after = result => {
      this.changelists.delete(obj);
      if (!result) return;
      if (typeof result === 'object') {
        if (!Array.isArray(result)) {
          if (result.toArray){
            return toArrayPromise(result).then(function(results) {
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
    return nodeify((
        q.insert ? this._insert(model, obj) :
        q.update ? this._update(model, idOf(obj), q.update) :
        Promise.resolve()
        ).then(after), cb);
  }

}

function idOf(obj) { return {_id: obj._id}; }

function promisifier(resolve, reject) {
  return function (err, result) {
    if (err) reject(err);
    else resolve(result);
  }
}

function toArrayPromise(result) {
  return new Promise(function(resolve, reject){
    result.toArray(promisifier(resolve, reject));
  });
}

function nodeify(p, cb) {
  if (cb) {
    p.then(function(result) {
      cb(null, result);
    }, function(err) {
      cb(err);
    });
  }
  return p;
}
