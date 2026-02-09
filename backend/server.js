const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./config/db");

const authRoutes = require("./routes/auth.routes");
const leadsRoutes = require("./routes/leads.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);

app.get("/", (req, res) => {
  res.send("CRM Backend is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("CRM Backend is running");
});