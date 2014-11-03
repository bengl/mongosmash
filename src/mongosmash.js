import observed from 'observed';
import queryGenerator from './queryGenerator';
import Promise from 'bluebird';

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

export default class MongoSmash {

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

  _handleChanges (obj, changes) {
    if (!Array.isArray(changes)) changes = [changes];
    let lists = this.changelists;
    for (let i = 0; i < changes.length; i++) {
      if (!lists.has(obj)) lists.set(obj, [changes[i]]);
      else if (!Array.isArray(lists.get(obj))) lists.set(obj, []);
      else {
        let list = lists.get(obj);
        if (list.indexOf(changes[i]) === -1)
          list.push(changes[i]);
      }
    }
  }

  _dbOp (model, op, args) {
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

  _observe (obj, model) {
    this.modelnames.set(obj, model);
    let observer = observed(obj);
    observer.on('change', changes => this._handleChanges(obj, changes));
    let oldObserver = this.observfers.get(obj);
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
        return Promise.promisify(results.toArray, results)().then(this._observeResults(model));
      else
        return this._observe(results, model);
    };
  };

  find (model, query, cb) {
    return this._find(model, query).then(this._observeResults(model)).nodeify(cb);
  }

  findOne (model, query, cb) {
    return this._findOne(model, query).then(this._observeResults(model)).nodeify(cb);
  }

  new (model, obj) {
    this.changelists.set(obj, ['insert']);
    this._observe(obj, model);
  }

  create (model, obj, cb) {
    this.new(model, obj);
    return this.save(obj).nodeify(cb);
  }

  delete (obj, cb) {
    let paramTwo = this.isNeDB ? {} : true;
    return this._remove(this.modelnames.get(obj), idOf(obj), paramTwo)
      .then(() => this.changelists.set(obj, [])).nodeify(cb);
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
        q.insert ? this._insert(model, obj) :
        q.update ? this._update(model, idOf(obj), q.update) :
        Promise.resolve()
        ).then(after).nodeify(cb);
  }

}

['insert', 'update', 'remove', 'find', 'findOne'].forEach(function(op){
  MongoSmash.prototype['_'+op] = function(model) { return this._dbOp(model, op, arguments); };
});

function idOf(obj) { return {_id: obj._id}; }
