const express = require("express");
const router = express.Router();

const data = require("../data");
const taskData = data.tasks;

router.post("/", async (req, res) => {
  try {
    const task = req.body;
    if (!task.name || task.name.length == 0)
      return res.render("tasks/home", {
        name_error: "You must provide task name",
      });
    if (!task.points)
      return res.render("tasks/home", {
        points_error: "You must provide task experience count",
      });
    if (!task.description)
      return res.render("tasks/home", {
        description_error: "You must provide task experience count",
      });
    if (!task.level)
      return res.render("tasks/home", {
        level_error: "You must provide task experience count",
      });
    const { name, points, description, level } = task;
    const newTask = await taskData.addTask(name, points, level, description);
    res.status(200).render("tasks/home", { success: "Created Successfully!" });
  } catch (e) {
    res.status(400).render("errors/error", { error: e });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ error: "Id must be passed as a parameter." });
    }
    const task = await taskData.getTaskById(id);
    if (!task) {
      return res
        .status(404)
        .json({ error: "Task not found with provided ID." });
    }
    res.render("tasks/show", { task: task });
  } catch (e) {
    return res.status(400).json({ error: e });
  }
});

router.get("/", async (req, res) => {
  try {
    const tasks = await taskData.getAllTasks();
    console.log(tasks);
    res.render("tasks/list", { title: "Wellness", task: tasks });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
});

module.exports = router;
