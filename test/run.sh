#!/bin/sh

negative_exit() {
  if [ "$1" != 0 ] ; then
    exit 1
  fi
}

delete_db() {
  if [ -f./test_db.sqlite ] ; then
    rm -f ./test_db.sqlite
  fi
}

### SETUP ###
. ~/.bashrc
export NODE_ENV=test
nvm use v4.4.6
negative_exit $?
delete_db
node ../node_modules/.bin/knex migrate:latest
negative_exit $?
node ../node_modules/.bin/knex seed:run
negative_exit $?
### END SETUP ###

node ../node_modules/.bin/mocha adds_cache_to_rds.js
negative_exit $?
delete_db
