var assert = require('chai').assert;
var MongoSmash = require('../index');
var nedb = require('nedb');
var mongo = require('mongodb');

function commonTests(type) {
  context(type, function(){
    var smash;

    before(function(done){
      if (type === 'nedb') {
        smash = new MongoSmash(nedb);
        done();
      } else if (type === 'mongodb') {
        var mongodb = require('mongodb').MongoClient;
        mongodb.connect('mongodb://127.0.0.1:27017/test', function(err, db){
          if (err) throw err;

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

    it('new, save, find, delete, and ensure deletion', function(done){
      var o = {};
      smash.new('things', o);
      o.hello = 'ok';
      smash.save(o, function(err, thing){
        assert.ifError(err);
        assert(thing);
        assert.equal(Object.keys(thing).length, 2);
        assert.equal(thing.hello, 'ok');
        assert.equal(typeof thing._id, type === 'nedb' ? 'string' : 'object');
        smash.find('things', {_id: thing._id}, function(err, newThings){
          var newThing = newThings[0];
          assert.ifError(err);
          assert.deepEqual(thing, newThing);
          smash.delete(newThing, function(err){
            assert.ifError(err);
            smash.find('things', {_id: newThing._id}, function(err, delThings){
              assert.ifError(err);
              assert.equal(delThings.length, 0);
              done();
            });
          });
        });
      });
    });

    it('create and findOne', function(done){
      smash.create('things', {hello: 'ok'}, function(err, thing){
        assert.ifError(err);
        assert(thing);
        assert.equal(Object.keys(thing).length, 2);
        assert.equal(thing.hello, 'ok');
        assert.equal(typeof thing._id, type === 'nedb' ? 'string' : 'object');
        smash.findOne('things', {_id: thing._id}, function(err, result) {
          assert.ifError(err);
          assert(result);
          assert.deepEqual(result, thing);
          done();
        });
      });
    });

    it('create, modify, save, findOne', function(done){
      smash.create('things', {hello: {ok: 1}, stuff: 3, arr: [1]}, function(err, thing){
        thing.hello.ok = 2;
        thing.stuff = 4;
        thing.other = 5;
        thing.arr.push(2);
        smash.save(thing, function(err) {
          assert.ifError(err);
          smash.findOne('things', {_id: thing._id}, function(err, result) {
            assert(result.arr[1] === 2);
            assert.ifError(err);
            assert.deepEqual(thing, result);
            done();
          });
        });
      });
    });
  });
}

describe('MongoSmash', function(){
  commonTests('nedb');
  commonTests('mongodb');
});



