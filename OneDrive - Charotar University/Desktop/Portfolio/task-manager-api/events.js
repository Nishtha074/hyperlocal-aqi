
const EventEmitter = require("events");

class TaskEvents extends EventEmitter { }

module.exports = new TaskEvents();
