# MongoSmash

![Mongo only pawn in game of life](http://padresteve.files.wordpress.com/2011/04/blazing-saddles-mongo.gif)

**MongoSmash** is a super-minimal MongoDB/NeDB ODM for Node.js. It lets you treat a JavaScript object as normal, and have changes persisted to MongoDB or NeDB. MongoSmash is implemented using `Object.observe`, and so is subject to its limitations on changes it can track, and requires Node 0.11.10+. You'll need to invoke node with the `--harmony` flag.

**WARNING: MongoSmash is incomplete. I'm just starting to explore this idea. It probably doesn't even work yet. Do not use, unless you're willing to fix it and make it actually work.**

### Example

```javascript
var dbURI = 'mongodb://127.0.0.1:27017/test';
require('mongodb').MongoClient.connect(dbURI, function(err, db) {
  if (err) throw err;

  var smash = require('mongosmash')(db);

  var fido = {breed: 'golden retriever', age: 3, gender: 'm', name: 'Fido'};

  // smash.create(modelname, obj, cb) is shorthand for smash.new + smash.save
  smash.new('dog', fido); // adds observers. 'dog' is the mongodb collection name
  smash.save(fido, function(err, savedFido) { // savedFido has a _id
    if (err) throw err;
    
    savedFido.owner = 'Joe';
    smash.save(fido, function(err) { // no savedFido this time since it's an update
      if (err) throw err;

      smash.find({name: 'einstein'}, function(err, dogs){
        if (err) throw err;

        var einstein = dogs[0];
        // ... do something w/ einstein
      });
    });
  });
});
```

##LICENSE

See LICENSE.txt
