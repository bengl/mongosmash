var assert = require('assert');
var MongoSmash = require('../index');

var DB = {
  collection: function(){
    return {
      insert: function(){
        console.log('insert:', arguments);
        arguments[1](null, arguments[0]);
      },
      update: function(){
        console.log('update:', arguments);
        arguments[arguments.length-1]();
      },
      remove: function(){
        console.log('remove:', arguments);
        arguments[arguments.length-1]();
      },
      find:   function(){
        console.log('find:', arguments);
        arguments[arguments.length-1]();
      }
    };
  }
};

var smash = MongoSmash(DB);

var o = {hello: 'ok'};

smash.create('thing', o, function(err, thing){
  assert.ifError(err);
  o.yo = 'sup';
  smash.save(o, function(err, thing){
    assert.ifError(err);
  });
});


