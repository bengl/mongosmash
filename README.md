# MongoSmash

![Mongo only pawn in game of life](http://padresteve.files.wordpress.com/2011/04/blazing-saddles-mongo.gif)

**MongoSmash** is a super-minimal MongoDB/NeDB ODM for Node.js. It lets you treat a JavaScript object as normal, and have changes persisted to MongoDB or NeDB. MongoSmash is implemented using `Object.observe`, and so is subject to its limitations on changes it can track, and requires Node 0.11.10+. You'll need to invoke node with the `--harmony` flag.

**WARNING: MongoSmash is incomplete. It works, but it's missind a lot of features!**

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

## API

### `new MongoSmash(db)`
You **must** pass in either an already-connected MongoDB connection (from
`nove-mongodb-native`) or the NeDB module in its entirety. For the moment, only
in-memory NeDB is supported.

### `#new(modelName, obj)`
Sets up an object (`obj`) to have its changes tracked so we can `save()` it
later. The `modelName` is equivalent to a MongoDB collection name. If you're
doing this, you probably actually want `create`.

### `#save(obj, callback)`
Does a MongoDB `insert` or `update` depending on the current status of the
object. The error-first-style `callback`, which will call with a resultant
object if it's a new object. The new object will also have a brand-new `_id`.

### `#create(modelName, obj, callback)`
Runs `new` and then `save` immediately.

### `#find(query, callback)`
Calls the `callback` error-first-style with an array of objects matching the
MongoDB `query`. For the moment, projections are not supported.

### `#delete(obj, callback)`
Deletes `obj` from the database, callback only takes in error.

## LICENSE

See LICENSE.txt
