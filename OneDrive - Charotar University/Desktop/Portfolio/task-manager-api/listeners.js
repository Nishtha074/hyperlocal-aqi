
const taskEvents = require("./events");

taskEvents.on("task-created", (task) => {
    console.log(
        `[Notification] Task "${task.title}" created at ${new Date().toISOString()}`
    );
});
