import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([
    { question: "", choices: ["", "", "", ""], answer: 0 },
  ]);
  const [zipUrl, setZipUrl] = useState("");

  const parseRawInput = () => {
    const blocks = rawInput.split(/\n\s*\n/).map(b => b.trim()).filter(b => b);
    const parsed = blocks.map(block => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      const headerMatch = lines[0].match(/^(MC|TF)::\s*(.+)$/);
      if (!headerMatch) return null;
      const type = headerMatch[1];
      const questionText = headerMatch[2];
      const choices = [];
      let answerIndex = 0;
      lines.slice(1).forEach((line, idx) => {
        const correct = line.startsWith('*~');
        const text = line.replace(/^[*]?~/, '').trim();
        choices.push(text);
        if (correct) answerIndex = idx;
      });
      return { question: questionText, choices, answer: answerIndex };
    }).filter(q => q);
    if (parsed.length) setQuestions(parsed);
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    if (field === "question") updated[index].question = value;
    else updated[index].choices[field] = value;
    setQuestions(updated);
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...questions];
    updated[index].answer = parseInt(value, 10);
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", choices: ["", "", "", ""], answer: 0 },
    ]);
  };

  const generateQTI = async () => {
    const zip = new JSZip();
    const meta = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<quiz ident=\"generated_quiz\">  
  <title>Generated Quiz</title>
  ${questions.map((_, i) => `<item_ref linkrefid=\"q${i + 1}\" />`).join("\n  ")}
</quiz>`;
    zip.file("assessment_meta.xml", meta);

    questions.forEach((q, i) => {
      const qti = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<questestinterop>
  <item ident=\"q${i + 1}\" title=\"Question ${i + 1}\">  
    <presentation>
      <material>
        <mattext texttype=\"text/plain\">${q.question}</mattext>
      </material>
      <response_lid ident=\"response${i + 1}\" rcardinality=\"Single\">  
        <render_choice>
          ${q.choices.map((c, j) => `
          <response_label ident=\"choice${j}\">  
            <material><mattext texttype=\"text/plain\">${c}</mattext></material>
          </response_label>`).join("")}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes>
        <decvar maxvalue=\"100\" minvalue=\"0\" varname=\"SCORE\" vartype=\"Decimal\" />
      </outcomes>
      <respcondition continue=\"No\">  
        <conditionvar>
          <varequal respident=\"response${i + 1}\">choice${q.answer}</varequal>
        </conditionvar>
        <setvar action=\"Set\">100</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
      zip.file(`qti_q${i + 1}.xml.qti`, qti);
    });

    zip.file("context.xml", "<context></context>");
    zip.file("course_settings.xml", "<course_settings></course_settings>");

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    setZipUrl(url);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label>Paste your questions here:</label><br />
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          rows={10}
          style={{ width: '100%' }}
          placeholder={`MC:: Question?\n~Choice1\n*~CorrectChoice\n...`}
        />
        <button onClick={parseRawInput} style={{ marginTop: '0.5rem' }}>Import from Text</button>
      </div>
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '0.5rem' }}>
          <div>
            <label>Question {i + 1}:</label><br />
            <textarea
              value={q.question}
              onChange={e => handleQuestionChange(i, 'question', e.target.value)}
              rows={2}
              style={{ width: '100%' }}
            />
          </div>
          {q.choices.map((c, j) => (
            <div key={j}>
              <label>Choice {String.fromCharCode(65 + j)}:</label>
              <input
                type="text"
                value={c}
                onChange={e => handleQuestionChange(i, j, e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          ))}
          <div>
            <label>Correct Answer (0-{q.choices.length - 1}):</label>
            <input
              type="number"
              min="0"
              max={q.choices.length - 1}
              value={q.answer}
              onChange={e => handleAnswerChange(i, e.target.value)}
              style={{ width: '50px' }}
            />
          </div>
        </div>
      ))}
      <button onClick={addQuestion}>Add Question</button>{' '}
      <button onClick={generateQTI}>Generate IMSCC</button>
      {zipUrl && (
        <div style={{ marginTop: '1rem' }}>
          <a href={zipUrl} download="quiz_canvas_schoology_ready.imscc">
            <button>Download IMSCC</button>
          </a>
        </div>
      )}
    </div>
  );
}
