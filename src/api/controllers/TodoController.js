
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
  createTodo(todo, res) {
    return this.todoService.create(todo)
      .then((newTodo) => {
        res.status(201);
        res.location(`/todo/${newTodo.id}`);
        res.json('OK');
      });
  }
  listTodos(page, pageSize) {
    return this.todoService.listTodos(page, pageSize);
  }
  get(id) {
    return this.todoService.getTodo(id)
      .then((todo) => {
        if (!todo) {
          throw HttpError.notFound(`Couldn't find a todo with id: ${id}`);
        }
        return todo;
      });
  }
  markCompleted(id, res) {
    return this.todoService.markCompleted(id)
      .then(() => {
        res.status(204);
        res.json('OK');
      });
  }
}

TodoController.autowire = {
  todoService: 'TodoService'
};

module.exports = TodoController;
