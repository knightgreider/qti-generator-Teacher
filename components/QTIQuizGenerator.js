import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

    const meta = `<?xml version="1.0" encoding="UTF-8"?>
<quiz ident="lettering_manual_quiz">
  <title>Lettering manual quiz</title>
  ${questions.map((_, i) => `<item_ref linkrefid="q${i + 1}" />`).join("\n  ")}
</quiz>`;

    zip.file("assessment_meta.xml", meta);

    questions.forEach((q, i) => {
      const qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="q${i + 1}" title="Question ${i + 1}">
    <presentation>
      <material>
        <mattext texttype="text/plain">${q.question}</mattext>
      </material>
      <response_lid ident="response${i + 1}" rcardinality="Single">
        <render_choice>
          ${q.choices
            .map(
              (c, j) => `
          <response_label ident="choice${j}">
            <material><mattext texttype="text/plain">${c}</mattext></material>
          </response_label>`
            )
            .join("")}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes>
        <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal" />
      </outcomes>
      <respcondition continue="No">
        <conditionvar>
          <varequal respident="response${i + 1}">choice${q.answer}</varequal>
        </conditionvar>
        <setvar action="Set">100</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
      zip.file(`g${Math.random().toString(36).substring(2)}.xml.qti`, qti);
    });

    zip.file("context.xml", "<context></context>");
    zip.file("course_settings.xml", "<course_settings></course_settings>");

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    setZipUrl(url);
  };

  return (
    <div className="space-y-4 p-4">
      {questions.map((q, i) => (
        <Card key={i} className="p-4">
          <CardContent className="space-y-2">
            <Textarea
              value={q.question}
              onChange={(e) => handleQuestionChange(i, "question", e.target.value)}
              placeholder={`Question ${i + 1}`}
            />
            {q.choices.map((c, j) => (
              <Input
                key={j}
                value={c}
                onChange={(e) => handleQuestionChange(i, j, e.target.value)}
                placeholder={`Choice ${String.fromCharCode(65 + j)}`}
              />
            ))}
            <Input
              type="number"
              min="0"
              max="3"
              value={q.answer}
              onChange={(e) => handleAnswerChange(i, e.target.value)}
              placeholder="Correct choice index (0-3)"
            />
          </CardContent>
        </Card>
      ))}
      <Button onClick={addQuestion}>Add Question</Button>
      <Button onClick={generateQTI}>Generate IMSCC ZIP</Button>
      {zipUrl && (
        <a href={zipUrl} download="quiz_canvas_schoology_ready.zip">
          <Button variant="outline">Download ZIP</Button>
        </a>
      )}
    </div>
  );
}
