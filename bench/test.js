var mongosmash = require('../index');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var Cat = mongoose.model('Cat', { name: String });

var iterations = 1000;

function bench(txt, fn, done){
  var did = 0;
  var time = process.hrtime();
  for (var i = 0; i < iterations; i++)
    fn(i, function(){
      did++;
      if (did === iterations) {
        var diff = process.hrtime(time);
        var ops = iterations/((diff[0] * 1e9 + diff[1])/1e9);
        console.log(txt+':', (Math.round(ops)/1000).toLocaleString(), 'K-ops/sec');
        done();
      }
    });
}

var smashTests = {
  name: 'mongosmash',
  setup: function(cb){
    require('mongodb').MongoClient.connect('mongodb://localhost/test', function(err, db) {
      if (err) throw err;
      global.smash = mongosmash(db);
      cb();
    });
  },
  new: function(i, cb){
    cats[i] = {name: 'cat'+i};
    global.smash.new('cat', cats[i]);
    cb();
  },
  save: function(i, cb){
    global.smash.save(cats[i], cb);
  },
  find: function(i, cb){
    global.smash.find('cat', {name: 'cat'+i}, function(err, kitties){
      cats[i] = kitties[0];
      cb();
    }); 
  },
  edit: function(i, cb){
    cats[i].name = 'kitty'+i;
    cb();
  },
  savedEdit: function(i, cb){
    global.smash.save(cats[i], cb);
  },
  delete: function(i, cb){
    global.smash.delete(cats[i], cb);
  },
  drop: function(done){
    global.smash.db.collection('cat').drop(done);
  }
};

var gooseTests = {
  name: 'mongoose',
  setup: function(cb){cb()},
  new: function(i, cb){
    cats[i] = new Cat({name: 'cat'+i});
    cb();
  },
  save: function(i, cb){
    cats[i].save(cb);
  },
  find: function(i, cb){
    Cat.find({name: 'cat'+i}, function(err, kitties){
      cats[i] = kitties[0];
      cb();
    });
  },
  edit: function(i, cb){
    cats[i].name = 'kitty'+i;
    cb();
  },
  savedEdit: function(i, cb){
    cats[i].save(cb);
  },
  delete: function(i, cb){
    Cat.remove({_id: cats[i]._id}, cb);
  },
  drop: function(done){
    Cat.collection.drop(done);
  }
};

function test(funcs, done) {
  setImmediate(function(){
    console.log('-------');
    global.cats = [];
    funcs.setup(function(){
      bench(funcs.name+' - new', funcs.new, function(){
        bench(funcs.name+' - save', funcs.save, function(){
          bench(funcs.name+' - find', funcs.find, function(){
            bench(funcs.name+' - edit', funcs.edit,function(){
              bench(funcs.name+' - saved edited', funcs.savedEdit, function(){
                bench(funcs.name+' - delete', funcs.delete, function(){
                  funcs.drop(done);
                });
              });
            });
          });
        });
      });
    });
  });
}


test(smashTests, function(){test(gooseTests, function(){ process.exit()})});
