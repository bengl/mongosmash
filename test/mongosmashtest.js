var assert = require('assert');
var MongoSmash = require('../index');
var nedb = require('nedb');
var mongodb = require('mongodb').MongoClient;
require('co-mocha');

var url = 'mongodb://127.0.0.1:27017/test';

function commonTests(type) {
  var smash;

  before(function(done){
    if (type === 'nedb') {
      smash = new MongoSmash(nedb);
      done();
    } else if (type === 'mongodb') {
      var mongodb = require('mongodb').MongoClient;
      mongodb.connect(url, function(err, db){
        smash = new MongoSmash(db);
        done();
      });
    }
  });

  if (type === 'mongodb') {
    after(function(done){
      smash.db.collection('things').drop(done);
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

  it('saving no changes works', function*(){
    yield smash.create('things', {hello: {ok: 1}, stuff: 3, arr: [1]});
    var foundThing = yield smash.findOne('things', {stuff: 3});
    yield smash.save(foundThing);
  });

  it('nodeified function works', function (done) {
    smash.create('things', {hello: {ok: 1}, stuff: 3, arr: [1]}, function (err, result){
      assert.ifError(err);
      assert(result);
      done();
    });
  });
}

describe('MongoSmash', function(){
  context('nedb', function(){
    context('common tests', function () {
      commonTests('nedb');
    });
    it('should properly cache dbs', function (){
      var smash = MongoSmash(nedb);
      var foo1 = smash.db.collection('foo');
      var foo2 = smash.db.collection('foo');
      var bar = smash.db.collection('bar');
      assert.strictEqual(foo1, foo2);
      assert.notStrictEqual(foo1, bar);
    });
  });
  context('mongodb', function () {
    context('common tests', function () {
      commonTests('mongodb');
    });
  });
  it('should throw if no mongo or nedb', function() {
    assert.throws(function() {
      MongoSmash();
    });
  });
});
