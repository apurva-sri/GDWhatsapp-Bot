// Express app setup
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const driveRoutes = require("./routes/driveRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const userRoutes = require("./routes/userRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/drive", driveRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/user", userRoutes);

// Error handler
app.use(errorHandler);

module.exports = app;
