var assert = require('chai').assert;
var queryGenerator = require('../lib/queryGenerator');
var observed = require('observed');

describe('queryGenerator', function(){
  var obj, q, changelist;
  before(function(){
    obj = {
      hello: {ok: 1},
      doublePlus: 2,
      stuff: 'a',
      stuffNum: 37,
      arr: [1],
      deleteMe: 'me',
      changeDelete: 'c',
      deleteReset:'j'
    };
    changelist = [];
    var observer = observed(obj);
    observer.on('change', observedHandler);
    obj.hello.ok = 2;
    obj.doublePlus = 3;
    obj.doublePlus = 5;
    obj.stuff = 37;
    obj.stuffNum = 'a';
    obj.other = 5;
    obj.arr.push(2);
    obj.arr.push(3);
    obj.arr.bob = 4;
    obj.changeDelete = 'd';
    delete obj.deleteMe;
    delete obj.changeDelete;
    delete obj.deleteReset;
    obj.deleteReset = 'k';
    observer.deliverChanges();
    q = queryGenerator(changelist, {isNeDB: false}).update;

    function observedHandler(changes) {
      if (!Array.isArray(changes)) changes = [changes];
      changelist = changelist.concat(changes);
    }
  });
  it('should set an existing value', function(){
    assert.equal(q.$set.stuff, 37);
    assert.equal(q.$set.stuffNum, 'a');
  });
  it('should set a new value', function(){
    assert.equal(q.$set.other, 5);
  });
  it('should increment an existing value in an object', function(){
    assert.equal(q.$inc['hello.ok'], 1);
    assert.equal(q.$inc.doublePlus, 3);
  });
  it('should push an element to an array, but not push odd props', function(){
    assert.deepEqual(q.$pushAll.arr, [2, 3]);
    assert.equal(q.$set['arr.bob'], 4);
  });
  it('should delete an existing value', function(){
    assert.equal(q.$unset.deleteMe, '');
  });
  it('should delete a changed value', function(){
    assert.equal(q.$unset.changeDelete, '');
    assert(!q.$set.hasOwnProperty('changeDelete'));
  });
  it('should undelete a reset value', function(){
    assert.equal(q.$set.deleteReset, 'k');
    assert.equal(typeof q.$unset.deleteReset, 'undefined');
  });
});

