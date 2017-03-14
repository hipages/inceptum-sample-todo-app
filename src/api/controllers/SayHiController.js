
class SayHiController {
  sayHi() {
    return { message: this.salute };
  }
}

SayHiController.autowire = {
  salute: '#application.salutation'
}

module.exports = SayHiController;
