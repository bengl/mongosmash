export function queryGenerator(list, smash){
  if (list.indexOf('insert') >= 0) return {insert: true};

  var query = {$set:{}, $unset:{}, _$incoriginal:{}};
  list.forEach(function(change){

    if (change.type == 'add') {
      if (isPush(change, smash)) {
        var path = change.path.split('.');
        path.pop();
        path = path.join('.');
        if (!query.$pushAll) query.$pushAll = {};
        if (!query.$pushAll[path]) query.$pushAll[path] = [];
        query.$pushAll[path].push(change.value);
        return;
      }
      query.$set[change.path] = change.value;
      if (typeof query.$unset[change.path] !== undefined) {
        delete query.$unset[change.path];
      }
    }
    if (change.type === 'update') {

      // dupe of deleting. also happens in change then delete.
      if (change.value === undefined) return;

      if (Array.isArray(change.object) && change.name === 'length') return;
      if (isInc(change, smash)) {
        if (!query.$inc) query.$inc = {};
        var orig = query._$incoriginal[change.path], newValue = change.value;
        if (!orig) {
          // need to store original values for $inc, since change.value lies.
          orig = change.oldValue;
          query._$incoriginal[change.path] = orig;
          query.$inc[change.path] = newValue - change.oldValue;
        }
        query.$inc[change.path] = newValue - orig;
        return;
      }
      query.$set[change.path] = change.value;
    }
    if (change.type === 'delete') {
      query.$unset[change.path] = "";
      // sets then deletions don't happen; value in update change is undefined.
    }
  });
  delete query._$incoriginal;
  if (!Object.keys(query.$set).length) delete query.$set;
  if (!Object.keys(query.$unset).length) delete query.$unset;
  return {update: query};
}

function isPush(change, smash){
  if (smash.isNeDB) return false;
  if (!Array.isArray(change.object)) return false;
  var index = parseInt(change.name);
  if (isNaN(index)) return false;
  if (typeof change.oldValue !== 'undefined') return false;
  return true;
}

function isInc(change, smash) {
  if (smash.isNeDB) return false;
  if (change.oldValue !== parseInt(change.oldValue)) return false;
  if (change.value !== parseInt(change.value)) return false;
  return true;
}
