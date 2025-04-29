import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse pasted MC:: or TF:: blocks into question objects
  const parseRawInput = () => {
    const blocks = rawInput.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const parsed = blocks.map(block => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const header = lines[0].match(/^(MC|TF)::\s*(.+)$/);
      if (!header) return null;
      const type = header[1];
      const text = header[2];
      const choices = [];
      let answer = 0;
      lines.slice(1).forEach((l, i) => {
        const isCorrect = l.startsWith('*~');
        const clean = l.replace(/^[*]?~/, '').trim();
        choices.push(clean);
        if (isCorrect) answer = i;
      });
      return { question: text, choices, answer };
    }).filter(Boolean);
    setQuestions(parsed);
  };

  // Generate Canvas-style IMSCC for Schoology import
  const generateIMSCC = async () => {
    const zip = new JSZip();

    // Add assessment_meta.xml
    const meta = `<?xml version="1.0" encoding="UTF-8"?>
<quiz ident="generated_quiz">
  <title>Generated Quiz</title>
  ${questions.map((_, i) => `<item_ref linkrefid="q${i+1}" />`).join("\n  ")}
</quiz>`;
    zip.file('assessment_meta.xml', meta);

    // Add each question as individual .xml.qti
    questions.forEach((q, i) => {
      const qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="q${i+1}" title="Question ${i+1}">
    <presentation>
      <material>
        <mattext texttype="text/plain">${q.question}</mattext>
      </material>
      <response_lid ident="response${i+1}" rcardinality="Single">
        <render_choice>
${q.choices.map((c,j) => `          <response_label ident="choice${j}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("\n")}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes>
        <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
      </outcomes>
      <respcondition continue="No">
        <conditionvar>
          <varequal respident="response${i+1}">choice${q.answer}</varequal>
        </conditionvar>
        <setvar action="Set">100</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
      zip.file(`q${i+1}.xml.qti`, qti);
    });

    // Add placeholders for other Schoology-imported files
    zip.file('context.xml', '<context/>');
    zip.file('course_settings.xml', '<course_settings/>');
    zip.file('files_meta.xml', '<files_meta/>');
    zip.file('media_tracks.xml', '<media_tracks/>');

    // Package as .imscc
    const blob = await zip.generateAsync({ type: 'blob' });
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{ padding: '1rem' }}>
      <textarea
        style={{ width: '100%', height: '150px' }}
        placeholder="MC:: ... or TF:: ... blocks"
        value={rawInput}
        onChange={e => setRawInput(e.target.value)}
      />
      <button onClick={parseRawInput} style={{ margin: '0.5rem 0' }}>Import from Text</button>

      {questions.map((q,i) => (
        <div key={i} style={{ border: '1px solid #ccc', margin: '1rem 0', padding: '0.5rem' }}>
          <strong>{i+1}. {q.question}</strong>
          {q.choices.map((c,j) => (
            <div key={j}>{String.fromCharCode(65+j)}. {c}</div>
          ))}
        </div>
      ))}

      <button onClick={generateIMSCC} disabled={!questions.length}>Download .imscc</button>
      {zipUrl && (
        <div style={{ marginTop: '1rem' }}>
          <a href={zipUrl} download="quiz.imscc">Click to Download IMSCC</a>
        </div>
      )}
    </div>
  );
}
