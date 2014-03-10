# MongoSmash

![Mongo only pawn in game of life](http://padresteve.files.wordpress.com/2011/04/blazing-saddles-mongo.gif)

[![Build Status](https://travis-ci.org/bengl/mongosmash.png?branch=master)](https://travis-ci.org/bengl/mongosmash)
[![Code Climate](https://codeclimate.com/github/bengl/mongosmash.png)](https://codeclimate.com/github/bengl/mongosmash)
[![Dependency Status](https://gemnasium.com/bengl/mongosmash.png)](https://gemnasium.com/bengl/mongosmash)

**MongoSmash** is a super-minimal MongoDB/NeDB ODM for Node.js. It lets you
treat JavaScript object as normal, and have changes persisted to MongoDB or
NeDB. MongoSmash is implemented using `Object.observe`, and so is subject to its
limitations on changes it can track, and requires Node 0.11.10+. You'll need to
invoke node with the `--harmony` flag.

**WARNING: MongoSmash is incomplete. It works, but it's missing a lot of
features!**

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

## Benchmarks

You can run the benchmarks yourself as shown below. The results here are from
my `MacBookAir5,2`. `K-ops/sec` means "thousand calls of the given function per
second", so higher is better.

```
$ node -v
v0.11.11
$ npm run bench

> mongosmash@0.1.0 bench /Users/benglish/mongosmash
> node --harmony bench/test

Failed to load c++ bson extension, using pure JS version
........................

OPERATION     | MONGOOSE KOps/s | MONGOSMASH KOps/s | DIFF %
------------------------------------------------------------
new           | 34.026          | 98.806            | 190.38
save          | 3.504           | 4.999             | 42.67
find          | 2.627           | 2.91              | 10.77
edit          | 55.441          | 174.096           | 214.02
saved edited  | 2.425           | 3.946             | 62.72
delete        | 5.915           | 6.99              | 18.17
```

Of course a head-to-head comparison with Mongoose isn't necessarily realistic,
since MongoSmash doesn't do things like validations. I recommend using a tool
like [revalidator](https://github.com/flatiron/revalidator) to do your object
validations.

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

## Contributing

Please do! Pull requests, bug reports and feature requests are more than 
welcome, and should be done using Github PRs and Issues. Please try to conform
to existing style (though I'm not very stylish), and don't forget tests and
docs! Also, if making a performance improvement, feel free to update the
benchmark data.

## LICENSE

See LICENSE.txt
