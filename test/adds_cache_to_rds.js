"use strict";

process.env.NODE_ENV = 'test';

var redis = require("redis")
    , client = redis.createClient()
    , assert = require('chai').assert
    , fs = require('fs')
    , Promise = require('bluebird')
    , spawn = require('child_process').spawn
    , request = require('request')
    , _ = require('lodash');

Promise.promisifyAll(client);

describe('ExpressReadablyRedis', function () {

    var app_proc;

    before(function() {

        app_proc = spawn('node', [__dirname + "/app.js"], {
            detached: true,
            cwd: __dirname
        });

        var deferred = Promise.defer();

        // ensure app.js starts before continue
        setTimeout(function() {
            deferred.resolve(true)
        }, 1000);
        return deferred.promise;

    });

    after(function() {
        app_proc.kill()
    });

    beforeEach(function () {
        return client.keysAsync("*")
            .then(function(keys) {
                var multi = client.multi();
                keys.forEach(function(key) {
                    multi.del(key);
                });
                return multi.exec();
            })
    });


    it("should add express response data to redis" ,function(done) {
        request.get('http://localhost:10999/api/users', function(err, res) {
            //console.log(res)
            return client.keysAsync("*")
                .then(function(keys) {
                    console.log(keys);
                    var k = keys.filter(function(i) {
                        if(i.match(/^GET\/api\/users-----/)) {
                            return i;
                        }
                    })[0];

                    client.getAsync(k)
                        .then(function(res, error) {
                            res = JSON.parse(res);
                            assert(res.length === 100);
                            done()
                        })
                })

        })

    })
});