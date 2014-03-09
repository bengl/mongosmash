module.exports = function(list, smash){
  if (list.indexOf('insert') >= 0) return {insert: true};

  var query = {$set:{}, $unset:{}};
  list.forEach(function(change){
    if (change.type == 'new') {
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
    }
    if (change.type === 'updated') {
      if (Array.isArray(change.object) && change.name === 'length') return;
      if (isInc(change, smash)) {
        var diff = change.value - change.oldValue;
        if (!query.$inc) query.$inc = {};
        if (query.$inc[change.path]) query.$inc[change.path] += diff;
        else query.$inc[change.path] = diff;
        return;
      }
      query.$set[change.path] = change.value;
      if (query.$unset[change.path]) delete query.$unset[change.path];
    }
    if (change.type === 'deleted') {
      query.$unset[change.path] = "";
      if (query.$set[change.path]) delete query.$set[change.path];
    }
  });
  if (!Object.keys(query.$set).length) delete query.$set;
  if (!Object.keys(query.$unset).length) delete query.$unset;
  return {update: query};
};

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
  if (change.value !== parseInt(change.value)) return false;
  if (change.oldValue !== parseInt(change.oldValue)) return false;
  return true;
}
