
exports.up = function(knex, Promise) {
    return knex.schema.createTable('user_groups', function (table) {
            table.increments('id').primary();
            table.string('user_id').references('id').inTable('users').notNullable();
            table.string('group_id').references('id').inTable('groups').notNullable();
            table.timestamps();
        })


};

exports.down = function(knex, Promise) {
  
};
