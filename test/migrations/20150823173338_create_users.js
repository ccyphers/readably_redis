
exports.up = function(knex, Promise) {
    return knex.schema.createTable('users', function (table) {
        table.increments('id').primary();
        table.string('username').notNullable();
        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.timestamps();
    })
};

exports.down = function(knex, Promise) {
  
};
