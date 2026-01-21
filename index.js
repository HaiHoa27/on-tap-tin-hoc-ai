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
- Viết câu hỏi trắc nghiệm CHỌN 1 ĐÁP ÁN ĐÚNG.
- Có đúng 4 lựa chọn A, B, C, D.
- CHỈ CÓ 1 đáp án đúng duy nhất.
- 3 đáp án còn lại phải SAI hoặc gây nhiễu hợp lý.
- Không được để nhiều đáp án đúng về mặt logic.
- Không ghi "Đáp án" trong question.
- Nếu phát hiện có hơn 1 đáp án đúng → tự sửa lại.
- Trường "answer" phải trùng CHÍNH XÁC với 1 phần tử trong "options".
Ví dụ đúng:

{
  "type": "mcq",
  "question": "Câu lệnh if trong Python dùng để làm gì?",
  "options": [
    "Rẽ nhánh theo điều kiện",
    "Lặp lại chương trình",
    "Khai báo biến",
    "Xuất dữ liệu ra file"
  ],
  "answer": "Rẽ nhánh theo điều kiện"
}

Nếu type = "tf":
- CHỈ viết câu KHẲNG ĐỊNH.
- Mỗi câu là một mệnh đề khẳng định hoàn chỉnh.
- TUYỆT ĐỐI không viết câu hỏi.
- TUYỆT ĐỐI không dùng dấu ?.
- KHÔNG dùng các từ: nào, gì, bao gồm, bao nhiêu, là gì.
- Không dùng dạng liệt kê.
- Có thể gắn Đúng hoặc Sai.
- Answer chỉ là: "Đúng" hoặc "Sai".
- Nội dung phải kiểm tra kiến thức cụ thể.
Ví dụ đúng:

{
  "type": "tf",
  "question": "Python có thể chạy trên nhiều hệ điều hành khác nhau.",
  "answer": "Đúng"
}

{
  "type": "tf",
  "question": "Lệnh print trong Python dùng để nhập dữ liệu từ bàn phím.",
  "answer": "Sai"
}

- Mỗi câu dài từ 8 đến 25 từ.
- Nội dung phù hợp chương trình Tin học THPT Việt Nam.
- Các câu hỏi KHÔNG được trùng ý nhau.
- Mỗi câu phải kiểm tra một kiến thức khác nhau.
- Không lặp lại cấu trúc câu giữa các câu.

Trước khi trả kết quả, hãy tự kiểm tra:
- MCQ đủ 4 options chưa?
- Có hơn 1 đáp án đúng không?
- TF có phải mệnh đề không?
- Có dấu ? không?
- Có trùng câu không?
Nếu sai → tự sửa rồi mới xuất JSON.

/* ====== KẾT THÚC ÉP ====== */
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

    // ===== FIX MCQ =====
    if (type === "mcq") {
      questions = questions.map((q, i) => {
        let question = (q.question || "").trim();

        // bỏ "Câu 1:"
        question = question.replace(/^Câu\s*\d+[:.]\s*/i, "");
        question = question.replace(/\s+/g, " ").trim();
        // đảm bảo là câu hỏi
        if (!question.endsWith("?")) {
          question = question + "?";
        }

        let options = Array.isArray(q.options) ? q.options : [];

        // nếu thiếu options → tạo giả
        if (options.length !== 4) {
          options = [
            "Đáp án đúng",
            "Phương án nhiễu 1",
            "Phương án nhiễu 2",
            "Phương án nhiễu 3",
          ];
        }

        // clean options
        options = options.map(o => o.replace(/^[A-D]\.?/i, "").trim());
        // remove duplicate options
        options = [...new Set(options)];

        // nếu sau khi lọc bị thiếu → bù
        while (options.length < 4) {
          options.push("Phương án nhiễu " + (options.length + 1));
        }

        // cắt nếu dư
        options = options.slice(0, 4);

        let answer = (q.answer || "").trim();

        // nếu answer không khớp options → set lại
        if (!options.includes(answer)) {
          answer = options[0];
        }

        return {
          type: "mcq",
          question,
          options,
          answer,
        };
      });
    }

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
    // ===== REMOVE DUPLICATE QUESTIONS =====
    const seen = new Set();
    questions = questions.filter(q => {
      const key = q.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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
