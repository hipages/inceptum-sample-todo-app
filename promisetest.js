
class MyService {

  loadListOfTodos() {    //// Readonly
    return ['1', 'df'];
  }

  markTodoDone(todoId) {    ///// Readwrite
    // marks it as done
  }
  markAllTodosDone() {   // Readwrite
    this.loadListOfTodos().forEach(this.markTodoDone);
  }
}


function sub() {
  console.log(this.my);
}

function main() {
  this.my = 1;
  sub.bind(this)();
}

main();

console.log(process.addAsyncListener);



const cls = require('continuation-local-storage');


class PromiseCreator {
  constructor() {
    this.name = 'PromiseCreator';
  }
  create() {
    return new Promise((resolve) => {
      console.log(`Inside of the first promise this is ${this} | ${this.name} ... Context: ${cls.getNamespace('namespace').get('key')}`);
      console.log('setting transaction');
      cls.getNamespace('namespace').set('t', { transaction: true });
      console.log(`Transaction in context: ${JSON.stringify(cls.getNamespace('namespace').get('t'))}`);
      setTimeout(resolve, 10);
      console.log(
        `Inside of the first promise, after next tick this is ${this} | ${this.name} ... Context: ${cls.getNamespace('namespace').get('key')}`);
      console.log(`Transaction in context: ${JSON.stringify(cls.getNamespace('namespace').get('t'))}`);
    }).then(() => {
      console.log(`Inside of the second promise this is ${this} | ${this.name} ... Context: ${cls.getNamespace('namespace').get('key')}`);
      console.log(`Transaction in context: ${JSON.stringify(cls.getNamespace('namespace').get('t'))}`);
    });
  }
}

class OtherClass {
  constructor() {
    this.name = 'OtherClass';
  }
  continue(promise) {
    return promise.then(() => {
      console.log(`Inside of the continue promise this is ${this} | ${this.name} ... Context: ${cls.getNamespace('namespace').get('key')}`);
      console.log(`Transaction in context: ${JSON.stringify(cls.getNamespace('namespace').get('t'))}`);
    });
  }
}
console.log('****************');


const namespace = cls.createNamespace('namespace');

let i = 0;
console.log(i++);
const creator = new PromiseCreator();
console.log(i++, 'Start of namespace run');
let promise = null;
namespace.run(() => {
  namespace.set('key', 'The value');
  promise = creator.create();
});
console.log(i++, 'End of namespace run');
const cont = new OtherClass();
console.log(i++);
cont.continue(promise);
console.log(i++);
setTimeout(() => { console.log('end'); }, 100);
