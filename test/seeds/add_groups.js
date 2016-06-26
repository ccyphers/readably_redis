exports.seed = function(knex, Promise) {
    var async = require('async')
        , deferred = Promise.defer()
        , process_q = async.queue(function(item, callback) {
            knex('groups').insert(item)
                .then(function(res) {
                    callback()
                })
                .catch(function(err) {
                    callback()
                })
        })

    process_q.drain = function() {
        deferred.resolve(true)
    }
    // Deletes ALL existing entries
    return knex('groups').del()
        .then(function(res) {
            var items = []
            for(var x = 1; x < 11; x++) {
                process_q.push({name: 'group_' + x});
            }
            return deferred.promise;
        })


};
