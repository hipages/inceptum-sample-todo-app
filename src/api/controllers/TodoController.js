
const { HttpError } = require('../../util/HttpError');

class TodoController {
  constructor() {
    this.todoService = null;
  }

  /**
   *
   * @param todo
   * @param {ServerResponse} res
   */
  * createTodo(todo, res) {
    try {
      const newTodo = yield this.todoService.create(todo);
      res.status(201);
      // res.contentType('application/json');
      res.location(`/todo/${newTodo.id}`);
      res.json('OK');
      // res.writeHeader(201, undefined, undefined);
    } catch (e) {
      console.log(e);
    }
  }
  * listTodos(page, pageSize) {
    return yield this.todoService.listTodos(page, pageSize);
  }
  * get(id) {
    const todo = yield this.todoService.getTodo(id);
    if (!todo) {
      throw HttpError.notFound(`Couldn't find a todo with id: ${id}`);
    }
    return todo;
  }
  * markCompleted(id, res) {
    yield this.todoService.markCompleted(id);
    res.status(204);
    res.json('OK');
  }
}

TodoController.autowire = {
  todoService: 'TodoService'
};

module.exports = TodoController;
