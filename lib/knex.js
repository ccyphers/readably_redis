"use strict";

var Promise = require('bluebird')
    , redis = require("redis")
    , _ = require('lodash')
    , async = require('async');


module.exports = function (settings) {
    settings = settings || {};
    settings.redis = settings.redis || {};
    settings.redis.host = settings.redis.host || '127.0.0.1';
    settings.redis.port = settings.redis.port || 6379;
    settings.ignore_tables = ['fingerprints'];

    var client = redis.createClient(settings.redis.port, settings.redis.host);
    Promise.promisifyAll(client);

    function Queue(deferred, data) {

        function rm_main_cache(path) {
            return client.delAsync(path)
        }

        function rm_meta_keys(table, path) {
            return client.sremAsync(table + "_paths", path)
                .then(function (res) {
                    return client.delAsync(table + "_" + path + "_set")
                })
        }

        function rm_keys(table, path) {
            return rm_main_cache(path)
                .then(function (res) {
                    return rm_meta_keys(table, path);
                })
        }

        var process_q = async.queue(function (item, callback) {

            // don't process any other checks - need to always delete on insert
            if(item.method === 'insert') {
                rm_keys(item.table, item.path)
                    .then(function (res) {
                        callback();
                    })
                    .catch(function (e) {
                        callback();
                    })

            } else {
                var p = get_path(item.path);
                //debugger
                client.getAsync(p + "_paging")
                    .then(function(res) {
                        if(res === 'true') {

                            rm_keys(item.table, item.path)
                                .then(function (res) {
                                    callback();
                                })
                                .catch(function (e) {
                                    callback();
                                })

                        } else {
                            client.smembersAsync(item.table + "_" + item.path + "_set")
                                .then(function (path_set) {
                                    item;


                                    var check_ids = item.ids.map(function (id) {
                                        return String(id);
                                    });

                                    // need to delete cached items
                                    if ((_.intersection(check_ids, path_set).length > 0)) {

                                        rm_keys(item.table, item.path)
                                            .then(function (res) {
                                                callback();
                                            })
                                            .catch(function (e) {
                                                callback();
                                            })
                                    }
                                })

                        }
                    })

            }


        }, 10);

        process_q.drain = function () {
            return deferred.resolve(data);
        };

        return process_q;
    }

    /**
     * when data is updated delete redis cache accordingly
     *
     * INSERT - Safest option is to assume that the new data will be part of a cache
     * so delete all keys that have references to this table
     *
     * UPDATE/DELETE - Check the ID for the updated/deleted record and see if it's part of a cache.  If the ID is found
     * delete the associated cache keys.
     */
    settings.post_exec_hook = function (data, query_obj) {
        //debugger
        var ct = query_obj.response.rowCount, ids = []
            , table = table_name(query_obj);

        if (settings.ignore_tables.indexOf(table) < 0) {

            if (query_obj.method === 'update' || query_obj.method === 'del') {

                query_obj.response.rows = query_obj.response.rows || [];

                ids = _.map(query_obj.response.rows, function (row) {
                    if (row.id) {
                        return row.id;
                    }
                })
            }

            // if there was at least one record resulting in a modification
            if (ct > 0 && query_obj.method !== 'select') {

                return client.smembersAsync(table + "_paths")
                    .then(function (res) {
                        //console.log(res);
                        table, ids, data, query_obj;

                        if (res.length > 0) {
                            var deferred = Promise.defer();

                            var q = new Queue(deferred, data);

                            res.forEach(function (p) {
                                q.push({table: table, path: p, ids: ids, method: query_obj.method});
                            });

                            return deferred.promise;
                        } else {
                            return Promise.resolve(true);
                        }


                    });

            } else {
                return Promise.resolve(data)
            }
        } else {
            return Promise.resolve(data)
        }

    };

    function table_name(obj) {
        obj.sql = obj.sql.replace(/\$\d{1,}/g, "\?");
        var qualifier = 'from';

        if (obj.method === 'update') {
            qualifier = 'update';
        } else if (obj.method === 'insert') {
            qualifier = 'into';
        }

        return obj.sql.split(qualifier + ' "')[1].split('"')[0];

    }

    function get_path(p) {
        return "/" + p.split(/.?\/(.*)-{1,}/)[1].split("-")[0];
    }

    return require('knex')(settings);
}


