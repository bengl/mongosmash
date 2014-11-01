var assert = require('assert');
var MongoSmash = require('../index');
var nedb = require('nedb');
var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb').MongoClient);

var url = 'mongodb://127.0.0.1:27017/test';

function commonTests(type) {
  context(type, function(){
    var smash;

    before(function*(){
      if (type === 'nedb') {
        smash = new MongoSmash(nedb);
      } else if (type === 'mongodb') {
        var mongodb = require('mongodb').MongoClient;
        var db = yield mongodb.connectAsync(url);
        smash = new MongoSmash(db);
      }
    });

    if (type === 'mongodb') {
      after(function*(){
        yield Promise.promisifyAll(smash.db.collection('things')).dropAsync();
      });
    }

    it('new, save, find, delete, and ensure deletion', function*(){
      var o = {};
      smash.new('things', o);
      o.hello = 'ok';
      var thing = yield smash.save(o);
      assert(thing);
      assert.equal(Object.keys(thing).length, 2);
      assert.equal(thing.hello, 'ok');
      assert.equal(typeof thing._id, type === 'nedb' ? 'string' : 'object');
      var newThings = yield smash.find('things', {_id: thing._id});
      newThing = newThings[0];
      assert.deepEqual(thing, newThing);
      yield smash.delete(newThing);
      var delThings = yield smash.find('things', {_id: newThing._id});
      assert.equal(delThings.length, 0);
    });

    it('create and findOne', function*(){
      var thing = yield smash.create('things', {hello: 'ok'});
      assert(thing);
      assert.equal(Object.keys(thing).length, 2);
      assert.equal(thing.hello, 'ok');
      assert.equal(typeof thing._id, type === 'nedb' ? 'string' : 'object');
      var result = yield smash.findOne('things', {_id: thing._id});
      assert(result);
      assert.deepEqual(result, thing);
    });

    it('create, modify, save, findOne', function*(){
      var thing = yield smash.create('things', {hello: {ok: 1}, stuff: 3, arr: [1]});
      thing.hello.ok = 2;
      thing.stuff = 4;
      thing.other = 5;
      thing.arr.push(2);
      yield smash.save(thing);
      var result = yield smash.findOne('things', {_id: thing._id});
      assert(result);
      assert(result.arr[1] === 2);
      assert.deepEqual(thing, result);
    });
  });
}

describe('MongoSmash', function(){
  commonTests('nedb');
  commonTests('mongodb');
});
