import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
console.log("KEY:", process.env.GROQ_API_KEY);
const app = express();
app.use(cors());
app.use(express.json());

app.post("/giai-thich", async (req, res) => {
  const { question, options, correctAnswer, userAnswer } = req.body;

  try {
    const prompt = `
Bạn là trợ giảng Tin học THPT.
Giải thích cho học sinh:

Câu hỏi: ${question}
Các lựa chọn: ${JSON.stringify(options)}
Đáp án đúng: ${correctAnswer}
Học sinh chọn: ${userAnswer}

Yêu cầu:
- Vì sao sai
- Đáp án đúng
- Nhắc kiến thức
- Viết dễ hiểu.
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    console.log("GROQ RESPONSE:", data);

    if (!data.choices) {
      return res.json({ text: "⚠️ AI chưa trả dữ liệu. Kiểm tra API Key." });
    }

    res.json({ text: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "❌ Lỗi server AI" });
  }
});

app.post("/chat", async (req, res) => {
  const { message, history } = req.body;

  try {
    const messages = [
      {
        role: "system",
        content:
          "Bạn là trợ giảng Tin học THPT Việt Nam. Trả lời ngắn gọn, dễ hiểu, đúng chương trình phổ thông.",
      },
      ...(history || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.4,
      }),
    });

    const data = await response.json();

    console.log("CHAT RESPONSE:", data);

    if (!data.choices) {
      return res.json({ reply: "⚠️ AI chưa phản hồi." });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "❌ Lỗi server AI" });
  }
});

app.post("/generate-questions", async (req, res) => {
  const { type, topic, count } = req.body;

  try {
    const prompt = `
Bạn là giáo viên Tin học THPT Việt Nam.

Hãy tạo ${count} câu hỏi về chủ đề: "${topic}"

Yêu cầu:
- Nếu type = "mcq": tạo trắc nghiệm 4 lựa chọn.
- Nếu type = "tf": tạo đúng/sai.
- Trả về JSON ARRAY.
- Không thêm chữ ngoài JSON.

Định dạng:

MCQ:
{
  "type": "mcq",
  "question": "...",
  "options": ["A...", "B...", "C...", "D..."],
  "answer": "A..."
}

TF:
{
  "type": "tf",
  "question": "...",
  "answer": "Đúng" hoặc "Sai"
}
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.json([]);

    let jsonText = text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json|```/g, "");
    }

    let questions;
  try {
    questions = JSON.parse(jsonText);
  } catch (e) {
    console.log("RAW AI:", jsonText);
    return res.status(500).json({ error: "AI trả dữ liệu sai JSON" });
  }

res.json(questions);

  } catch (err) {
    console.error("GEN ERROR:", err);
    res.status(500).json({ error: "Lỗi tạo câu hỏi" });
  }
});


app.get("/test", async (req, res) => {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    });

    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("AI Server chạy tại port " + PORT);
});