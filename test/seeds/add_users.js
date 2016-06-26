exports.seed = function(knex, Promise) {
    var async = require('async')
        , deferred = Promise.defer()
        , process_q = async.queue(function(item, callback) {
            knex('users').insert(item)
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
    return knex('users').del()
        .then(function(res) {
            var items = []
            for(var x = 1; x < 101; x++) {
                process_q.push({username: 'username_' + x, first_name: 'first_name_' + x, last_name: 'last_name_' + x});
            }
            return deferred.promise;
        })


};
