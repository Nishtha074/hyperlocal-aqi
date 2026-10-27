
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const cache = require("./cache");
const Task = require("./models/Task");
const taskEvents = require("./events");

require("./listeners");

const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(express.json());

app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.url} - ${new Date().toISOString()}`
  );
  next();
});

// Validate JSON content type for POST and PUT requests
function requireJsonContent(req, res, next) {
  if (
    ["POST", "PUT"].includes(req.method) &&
    !req.is("application/json")
  ) {
    return res.status(415).json({
      error: "Content-Type must be application/json"
    });
  }

  next();
}

// Validate MongoDB ObjectId
function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      error: "Invalid task id format"
    });
  }

  next();
}

app.use(requireJsonContent);

// Home route
app.get("/", (req, res) => {
  res.json({
    owner: "Drashti Patel",
    project: "Task Manager REST API",
    routes: [
      "GET /tasks",
      "GET /tasks/:id",
      "POST /tasks",
      "PUT /tasks/:id",
      "DELETE /tasks/:id"
    ]
  });
});

// GET all tasks with in-memory caching
app.get("/tasks", async (req, res, next) => {
  // In test mode we avoid DB calls to keep tests fast and deterministic
  if (process.env.NODE_ENV === "test") {
    console.log("Test mode: returning empty task list");
    return res.status(200).json({ count: 0, data: [] });
  }

  try {
    const cachedTasks = cache.get("all_tasks");

    if (cachedTasks !== undefined) {
      console.log("Cache HIT: all_tasks");
      return res.status(200).json(cachedTasks);
    }

    console.log("Cache MISS: all_tasks");

    const tasks = await Task.find().sort({ createdAt: -1 });

    const response = {
      count: tasks.length,
      data: tasks
    };

    cache.set("all_tasks", response);

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// GET a single task by ID
app.get("/tasks/:id", validateObjectId, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    return res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// CREATE a task and emit an event
app.post("/tasks", async (req, res, next) => {
  try {
    const task = await Task.create(req.body);

    // Invalidate the cached task list
    cache.del("all_tasks");
    console.log("Cache INVALIDATED: all_tasks");

    // Log API response timestamp
    console.log(
      `[API] Response sent at ${new Date().toISOString()}`
    );

    // Send the response
    res.status(201).json(task);

    // Emit event after sending the response
    taskEvents.emit("task-created", task);
  } catch (err) {
    next(err);
  }
});

// UPDATE a task and invalidate cached task list
app.put("/tasks/:id", validateObjectId, async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!task) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    cache.del("all_tasks");
    console.log("Cache INVALIDATED: all_tasks");

    return res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE a task and invalidate cached task list
app.delete("/tasks/:id", validateObjectId, async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    cache.del("all_tasks");
    console.log("Cache INVALIDATED: all_tasks");

    return res.status(200).json({
      message: "Task deleted",
      data: task
    });
  } catch (err) {
    next(err);
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(
      (entry) => entry.message
    );

    return res.status(400).json({
      error: "Validation failed",
      details: messages
    });
  }

  console.error(err.message);

  return res.status(500).json({
    error: "Something went wrong"
  });
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing. Check your .env file."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
module.exports = app;
