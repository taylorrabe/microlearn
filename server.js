const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const lessons = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "lessons.json"), "utf-8")
);

app.get("/api/lessons", (req, res) => {
  const { category, date } = req.query;

  if (date) {
    const dayIndex = dateToDayIndex(date);
    const lesson = lessons[dayIndex % lessons.length];
    return res.json(lesson);
  }

  if (category && category !== "all") {
    return res.json(lessons.filter((l) => l.category === category));
  }

  res.json(lessons);
});

app.get("/api/lesson/today", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const dayIndex = dateToDayIndex(today);
  res.json(lessons[dayIndex % lessons.length]);
});

app.get("/api/lesson/:id", (req, res) => {
  const lesson = lessons.find((l) => l.id === parseInt(req.params.id));
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });
  res.json(lesson);
});

app.get("/api/categories", (req, res) => {
  const categories = [...new Set(lessons.map((l) => l.category))];
  res.json(categories);
});

function dateToDayIndex(dateStr) {
  const epoch = new Date("2025-01-01").getTime();
  const target = new Date(dateStr).getTime();
  return Math.floor((target - epoch) / (1000 * 60 * 60 * 24));
}

app.listen(PORT, () => {
  console.log(`MicroLearn running at http://localhost:${PORT}`);
});
