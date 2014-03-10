var mongosmash = require('../index');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var Cat = mongoose.model('Cat', { name: String });

var iterations = 1000;

var results = {mongoose:{}, mongosmash:{}};

function bench(engine, txt, fn, done){
  process.stdout.write('.');
  var did = 0;
  var time = process.hrtime();
  for (var i = 0; i < iterations; i++)
    fn(i, function(){
      did++;
      if (did === iterations) {
        var diff = process.hrtime(time);
        var ops = iterations/((diff[0] * 1e9 + diff[1])/1e9);
        results[engine][txt] = (Math.round(ops)/1000);
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
    global.cats = [];
    funcs.setup(function(){
      bench(funcs.name, 'new', funcs.new, function(){
        bench(funcs.name, 'save', funcs.save, function(){
          bench(funcs.name, 'find', funcs.find, function(){
            bench(funcs.name, 'edit', funcs.edit,function(){
              bench(funcs.name, 'saved edited', funcs.savedEdit, function(){
                bench(funcs.name, 'delete', funcs.delete, function(){
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

function pad(str, len) {
  var newStr = ''+str;
  var diff = len - newStr.length;
  while (diff-- > 0) {
    newStr += ' ';
  }
  return newStr;
}

function resultPrinter() {
  console.log('\n');
  console.log('OPERATION     | MONGOOSE KOps/s | MONGOSMASH KOps/s | DIFF %')
  console.log('------------------------------------------------------------');
  Object.keys(results.mongoose).forEach(function(op){
    var goose = results.mongoose[op], smash = results.mongosmash[op];
    var diff = (100*(smash - goose)/goose).toFixed(2);
    var line = [pad(op, 13), pad(goose, 15), pad(smash, 17), diff].join(' | ');
    console.log(line);
  });
  process.exit();
}

// Warm up by running both tests, then run them both again for real.
test(smashTests, function(){
  test(gooseTests, function(){
    test(smashTests, function(){
      test(gooseTests, resultPrinter);
    });
  });
});
