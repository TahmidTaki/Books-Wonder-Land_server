const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("book resale server is running");
});

app.listen(port, () => {
  console.log(`book resale running at port ${port}`);
});
