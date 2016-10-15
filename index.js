var Promise = require('bluebird')
    , crypto = require('crypto');

function ReadablyRedis(settings) {
    settings = settings || {};
    settings.allowed_methods = settings.allowed_methods || [];
    settings.ignore_keys = settings.ignore_keys || [];


    settings.path_filter = settings.path_filter || new RegExp("*");

    var self = this;

    // private helper

    function parse(i) {
        i = i || "";
        var fp = "";

        if(typeof(i) == 'object') {
            for(var key in i) {
                if(settings.ignore_keys.indexOf(key) < 0) {
                    fp += key + "=" + i[key];
                }
            }
        } else {
            fp = i;
        }

        return fp;
    }

    function allowed(http_method, url) {
        return settings.path_filter.exec(url) && settings.allowed_methods.indexOf(http_method) > -1
    }

    function get_key(req) {
        var shasum = crypto.createHash('sha1')
        shasum.update(parse(req.body) + parse(req.query) + parse(req.params));
        var sum = shasum.digest('hex');
        return req.method + req.path + "-----" + sum;
    }

    // update a series of keys and sets so that one can quickly look up
    // if a piece of cache data is dirty on data updates at the DB side
    function set_meta(path, key, meta, paging) {
        var tables = Object.keys(meta);

        var chain = settings.client.multi();
        chain.set(path + "_paging", paging);

        for(var table in meta) {
            chain.sadd(table + "_" + key + "_set", meta[table]);
            chain.sadd(table + "_paths", key);
        }

        return Promise.resolve(chain.exec());
    }

    // end private helpers

    // expose interface
    this.wrap = function(req, res, next) {

        if(allowed(req.method, req.path)) {
            var key = get_key(req);

            settings.client.get(key, function (err, reply) {
                if (reply) {
                    // application/json; charset=utf-8
                    res.set('Content-Type', 'application/json; charset=utf-8')
                    res.send(reply)
                } else {

                    var end = res.end;
                    res.end = function (chunk, encoding) {

                        res.end = end;

                        // list of {TableName: [IDs]} mapping
                        if(res._headers['x-cache-ids']) {
                          var cache_map = JSON.parse(res._headers['x-cache-ids']);
                        }
                        // on a 304 there will be no data in the chunk - need to ensure
                        // caller sets an item in the header so we can access the data to cache
                        if(chunk != "") {
                            var cache = chunk.toString()
                        } else {
                            var cache = res._headers['x-cache-response'];
                        }

                        var paging = false;
                        if(res._headers.hasOwnProperty('x-cache-paging')) {
                            paging = true;
                        }

                        res._headers['x-cache-ids'] = "";
                        res._headers['x-cache-paging'] = "";
                        res._headers['x-cache-response'] = "";
                        if(cache_map) {
                        set_meta(req.path, key, cache_map, paging)
                            .then(function (meta_res) {
                                settings.client.set(key, cache, function (err, set_res) {
                                    res.end(cache, encoding);
                                })
                            })
                        } else {
                          settings.client.set(key, cache, function (err, set_res) {
                            res.end(cache, encoding);
                          })
                        }
                    }
                    next();
                }
            });
        } else {
            next()
        }
    }

}


module.exports = function(settings) {
    settings = settings || {}
    settings.redis = settings.redis || {}
    settings.redis.host = settings.redis.host || '127.0.0.1'
    settings.redis.port = settings.redis.port || 6379;

    var redis = require("redis")
        , client = redis.createClient(settings.redis.port, settings.redis.host);

    return function(req, res, next) {
        settings, client;
        var readably_redis = new ReadablyRedis(settings);
        settings.client = client;
        readably_redis.wrap(req, res, next);
    }
}
