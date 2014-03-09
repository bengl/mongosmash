var assert = require('chai').assert;
var queryGenerator = require('../lib/queryGenerator');
var observed = require('observed');

describe('queryGenerator', function(){
  var obj, q, changelist;
  before(function(done){
    obj = {hello: {ok: 1}, stuff: 'a', arr: [1]};
    changelist = [];
    var observer = observed(obj);
    observer.on('changed', observedHandler);
    obj.hello.ok = 2;
    obj.stuff = 'b';
    obj.other = 5;
    obj.arr.push(2);
    obj.arr.push(3);
    setImmediate(function(){
      q = queryGenerator(changelist, {isNeDB: false}).update;
      done();
    });

    function observedHandler(changes) {
      if (!Array.isArray(changes)) changes = [changes];
      changelist = changelist.concat(changes);
    }
  });
  it('should set an existing value', function(){
    assert.equal(q.$set.stuff, 'b');
  });
  it('should set a new value', function(){
    assert.equal(q.$set.other, 5);
  });
  it('should increment an existing value in an object', function(){
    assert.equal(q.$inc['hello.ok'], 1);
  });
  it('should push an element to an array', function(){
    assert.deepEqual(q.$pushAll.arr, [2, 3]);
  });

});

