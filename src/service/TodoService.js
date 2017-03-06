const uuid = require('uuid');

class TodoService {
  * create(todo) {
    const newTodo = {
      id: uuid.v4(),
      description: todo.description,
      completed: false
    };
    yield this.mysqlClient.execute('INSERT INTO todo (id,description,completed) VALUES (?,?,?)',
      [newTodo.id, newTodo.description, newTodo.completed]);
    return newTodo;
  }

  * listTodos(page, pageSize) {
    const start = ((page - 1) * pageSize) + 1;
    const numRows = yield this.countTodos();
    const rows = numRows > 0 ? yield this.getTodos(start, pageSize) : [];
    const response = {};
    response.pageInfo = {
      numResults: numRows,
      pageNum: page,
      pageSize
    };
    response.items = rows.map((row) => this.rowToModel(row));
    return response;
  }

  * getTodos(start, size) {
    return yield this.mysqlClient.queryAll('SELECT id,description,completed FROM todo LIMIT ?, ?', [start, size]);
  }
  rowToModel(row) {
    return {
      id: row.id,
      description: row.description,
      completed: !!row.completed
    };
  }
  * getTodo(id) {
    const rows = yield this.mysqlClient.queryAll('SELECT id,description,completed FROM todo WHERE id=?', [id]);
    if (rows === null || rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return this.rowToModel(row);
  }
  * countTodos() {
    const rows = yield this.mysqlClient.queryAll('SELECT count(*) AS numTodos FROM todo');
    if (rows === null || rows.length === 0) {
      return 0;
    }
    const row = rows[0];
    return row.numTodos;
  }
  * markCompleted(id) {
    yield this.mysqlClient.execute('UPDATE todo SET completed=1 WHERE id=?', [id]);
  }
}

TodoService.transactional = {
  create: 'readwrite',
  markCompleted: 'readwrite',
  default: 'readonly'
};

TodoService.autowire = {
  mysqlClient: 'mainMySQLClient'
};

module.exports = { TodoService };
