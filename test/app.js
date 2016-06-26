"use strict";

process.env.NODE_ENV = 'test';

var express = require('express')
    , app = express()
    , body_parser = require('body-parser')
    , conf = require('./knexfile.js')
    , env = 'test'
    , settings = conf[env]
    , Promise = require('bluebird')
    , _ = require('lodash');

var knex = require('../lib/knex')(settings);

app.use(body_parser.urlencoded({ extended: false }));
app.use(body_parser.json());

var readably_redis = require('../index')({
    path_filter: new RegExp("^\/api")
    , ignore_keys: ['uuid']
    , allowed_methods: ['GET']
});

app.use(readably_redis);


function get_all(table, res) {
    return knex.table(table).select("*")
        .then(function(records) {

            var ids = _.map(records, function(record) {
                return record.id
            });

            var tmp = {};
            tmp[table] = ids;
            res.set("X-Cache-IDS", JSON.stringify(tmp));
            res.set("X-Cache-Response", JSON.stringify(records));
            return Promise.resolve({res: res, records: records})
        });
}

app.get('/api/users', function(req, res) {
    console.log("IN /api/users");
    get_all('users', res)
        .then(function(results) {
            var res = results.res;
            res.json(results.records)
        });
});

app.get('/api/groups', function(req, res) {
    get_all('groups', res)
        .then(function(results) {
            var res = results.res
            res.json(results.records)
        });
});

app.get('/api/paged_users', function(req, res) {
    //debugger

    var offset = Number(req.query.page) * 10;
    console.log(offset);
    knex.table("users").select("*").offset(offset).limit(10).orderBy('id')
        .then(function(users) {

            var ids = _.map(users, function(user) {
                return user.id
            })

            res.set("X-Cache-IDS", JSON.stringify({users: ids}));

            // setting X-Cache-Paging lets the request wrapper building the cache for Redis
            // know that the call is paged based so all pages related to the path must be deleted
            // when data is modified
            res.set("X-Cache-Paging", "");

            res.set("X-Cache-Response", JSON.stringify(users));
            res.json(users)
        })
})


app.listen(10999);