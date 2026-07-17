const XLSX = require("xlsx");
const fs = require("fs");

/* ================= LOAD EXCEL ================= */

const workbook = XLSX.readFile(
  "C:\\Users\\jvipu\\Downloads\\MSc-Forensic-science-quiz\\psB1.xlsx",
  { raw: true }
);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

/* ================= PARSE SHEET ================= */

const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: "",
  trim: true,
});

/* ================= HELPER ================= */

const isEmpty = (val) =>
  val === undefined || val === null || String(val).trim() === "";

/* ================= BUILD QUESTIONS ================= */

const questions = [];

rows.forEach((row, index) => {
  const questionText = row["Question"];
  const optionA = row["Option A"];
  const optionB = row["Option B"];
  const optionC = row["Option C"];
  const optionD = row["Option D"];
  const rawAnswer = String(row["Answer"]).trim().toUpperCase();

  // Skip completely blank rows
  if (
    isEmpty(questionText) &&
    isEmpty(optionA) &&
    isEmpty(optionB) &&
    isEmpty(optionC) &&
    isEmpty(optionD)
  ) {
    return;
  }

  // Validate required fields
  if (
    isEmpty(questionText) ||
    isEmpty(optionA) ||
    isEmpty(optionB) ||
    isEmpty(optionC) ||
    isEmpty(optionD)
  ) {
    console.log(`⚠ Skipping invalid row ${index + 2}`);
    return;
  }

  const validAnswers = ["OPTION A", "OPTION B", "OPTION C", "OPTION D"];

  if (!validAnswers.includes(rawAnswer)) {
    console.log(`⚠ Invalid answer at row ${index + 2}`);
    return;
  }

  questions.push({
    question: String(questionText),
    options: [
      { value: "OPTION A", text: String(optionA) },
      { value: "OPTION B", text: String(optionB) },
      { value: "OPTION C", text: String(optionC) },
      { value: "OPTION D", text: String(optionD) },
    ],
    answer: rawAnswer,
  });
});

/* ================= FINAL QUIZ PAYLOAD ================= */

const quizPayload = {
  name: "Mock Test 1-PS",
  passMark: 40,
  total: questions.length,
  duration: 105,
  questions,
};

/* ================= WRITE JSON ================= */

fs.writeFileSync(
  "quiz_batch1_ps.json",
  JSON.stringify(quizPayload, null, 2)
);

console.log(
  `✅ quiz_batch1_csmtech.json created successfully with ${questions.length} questions`
);
