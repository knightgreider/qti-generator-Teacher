import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [questions, setQuestions] = useState([
    { question: "", choices: ["", "", "", ""], answer: 0 },
  ]);
  const [zipUrl, setZipUrl] = useState("");

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    if (field === "question") updated[index].question = value;
    else updated[index].choices[field] = value;
    setQuestions(updated);
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...questions];
    updated[index].answer = parseInt(value);
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

    // Meta file
    const meta = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<quiz ident=\"lettering_manual_quiz\">  
  <title>Lettering manual quiz</title>
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
          ${q.choices
            .map(
              (c, j) => `
          <response_label ident=\"choice${j}\">  
            <material><mattext texttype=\"text/plain\">${c}</mattext></material>
          </response_label>`
            )
            .join("")}
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
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '0.5rem' }}>
          <div>
            <label>
              Question {i + 1}:
              <br />
              <textarea
                value={q.question}
                onChange={(e) => handleQuestionChange(i, 'question', e.target.value)}
                rows={3}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          {q.choices.map((c, j) => (
            <div key={j}>
              <label>
                Choice {String.fromCharCode(65 + j)}:
                <input
                  type="text"
                  value={c}
                  onChange={(e) => handleQuestionChange(i, j, e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          ))}
          <div>
            <label>
              Correct Answer (0-3):
              <input
                type="number"
                min="0"
                max="3"
                value={q.answer}
                onChange={(e) => handleAnswerChange(i, e.target.value)}
                style={{ width: '50px' }}
              />
            </label>
          </div>
        </div>
      ))}
      <button onClick={addQuestion}>Add Question</button>{' '}
      <button onClick={generateQTI}>Generate IMSCC ZIP</button>
      {zipUrl && (
        <div style={{ marginTop: '1rem' }}>
          <a href={zipUrl} download="quiz_canvas_schoology_ready.zip">
            <button>Download ZIP</button>
          </a>
        </div>
      )}
    </div>
  );
}
