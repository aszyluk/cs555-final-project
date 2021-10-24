// This is the central point that our routers confer to. Here is where our individual routes come together and get read by the server.
const mainRoutes = require("./main");
const taskRoutes = require("./tasks");
const userRoutes = require("./users");

const constructorMethod = (app) => {
  app.use("/", mainRoutes);
  app.use("/task", taskRoutes);
  app.use("/profile", userRoutes);

  app.use("*", (req, res) => {
    res.status(404).render("errors/error", { error: "404: Page Not Found" });
  });
};
module.exports = constructorMethod;
