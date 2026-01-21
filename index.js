import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= GIẢI THÍCH ================= */
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

    if (!data.choices) {
      return res.json({ text: "⚠️ AI chưa trả dữ liệu. Kiểm tra API Key." });
    }

    res.json({ text: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "❌ Lỗi server AI" });
  }
});

/* ================= CHAT ================= */
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

    if (!data.choices) {
      return res.json({ reply: "⚠️ AI chưa phản hồi." });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "❌ Lỗi server AI" });
  }
});

/* ================= TẠO CÂU HỎI ================= */
app.post("/generate-questions", async (req, res) => {
  const { type, topic, count } = req.body;

  try {
    const prompt = `
Bạn là giáo viên Tin học THPT Việt Nam.

Tạo ${count} câu hỏi về chủ đề: "${topic}".

QUY TẮC:

Nếu type = "mcq":
- Viết câu hỏi dạng lựa chọn.
- Có đúng 4 đáp án A, B, C, D.
- Không ghi "Đáp án" trong question.

Nếu type = "tf":
- CHỈ viết câu KHẲNG ĐỊNH.
- TUYỆT ĐỐI không viết câu hỏi.
- TUYỆT ĐỐI không dùng dấu ?.
- KHÔNG dùng các từ: nào, gì, bao gồm, bao nhiêu, là gì.
- Mỗi câu phải là mệnh đề hoàn chỉnh.
- Có thể gắn Đúng hoặc Sai.
- Answer chỉ là: "Đúng" hoặc "Sai".

Trả về JSON ARRAY thuần, không markdown, không giải thích.

Định dạng:

[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A...", "B...", "C...", "D..."],
    "answer": "A..."
  }
]

Hoặc với tf:

[
  {
    "type": "tf",
    "question": "...",
    "answer": "Đúng"
  }
]
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

    let text = data.choices?.[0]?.message?.content;
    if (!text) return res.json([]);

    console.log("RAW AI:", text);

    // clean markdown
    text = text.replace(/```json|```/g, "").trim();

    // cut valid JSON
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;

    if (start === -1 || end === -1) {
      return res.status(500).json({ error: "AI format sai" });
    }

    const jsonText = text.slice(start, end);

    let questions = JSON.parse(jsonText);

    // ===== FIX TRUE/FALSE =====
    if (type === "tf") {
      questions = questions.map((q, i) => {
        let text = (q.question || "").trim();

        // bỏ "Câu 1:"
        text = text.replace(/^Câu\s*\d+[:.]\s*/i, "");

        // bỏ dấu ?
        text = text.replace(/\?/g, "");

        // bỏ cụm hỏi
        text = text.replace(/\b(nào|gì|bao gồm|bao nhiêu|là gì)\b/gi, "");

        // dọn khoảng trắng
        text = text.replace(/\s+/g, " ").trim();

        // nếu câu quá ngắn → tạo lại dạng khẳng định
        if (text.length < 15) {
          text = `Python là một ngôn ngữ lập trình thông dụng trong Tin học.`; 
        }

        // đảm bảo kết thúc bằng .
        if (!text.endsWith(".")) text += ".";

        // fix answer
        let ans = (q.answer || "").trim();
        if (!["Đúng", "Sai"].includes(ans)) {
          ans = Math.random() > 0.5 ? "Đúng" : "Sai";
        }

        return {
          type: "tf",
          question: text,
          answer: ans
        };
      });
    }
    res.json(questions);

  } catch (err) {
    console.error("GEN ERROR:", err);
    res.status(500).json({ error: "Lỗi tạo câu hỏi" });
  }
});

/* ================= TEST ================= */
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
