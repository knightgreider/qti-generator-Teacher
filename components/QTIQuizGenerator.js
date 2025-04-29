import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

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

  const handleQuestionChange = (idx, field, value) => {
    const updated = [...questions];
    if (field === 'question') updated[idx].question = value;
    else updated[idx].choices[field] = value;
    setQuestions(updated);
  };

  const handleAnswerChange = (idx, value) => {
    const updated = [...questions];
    updated[idx].answer = parseInt(value, 10) || 0;
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', choices: ['', '', '', ''], answer: 0 }]);
  };

  const generateIMSCC = async () => {
    const zip = new JSZip();
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="gen1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">  
  <organizations/>  
  <resources>  
    <resource identifier="res1" type="imsqti_xmlv1p2" href="assessment.xml">  
      <file href="assessment.xml"/>  
    </resource>  
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    const assessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment title="Generated Quiz">
    <section ident="root_section">
${questions.map((q,i) => `      <item ident="q${i+1}" title="Question ${i+1}">
        <presentation>
          <material><mattext texttype="text/plain">${q.question}</mattext></material>
          <response_lid ident="response${i+1}" rcardinality="Single">
            <render_choice>
${q.choices.map((c,j) => `              <response_label ident="choice${j}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("\n")}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No"><conditionvar><varequal respident="response${i+1}">choice${q.answer}</varequal></conditionvar><setvar action="Set">100</setvar></respcondition>
        </resprocessing>
      </item>`).join("\n")}
    </section>
  </assessment>
</questestinterop>`;

    zip.file('assessment.xml', assessment);
    zip.file('context.xml', '<context/>');
    zip.file('course_settings.xml', '<course_settings/>');

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
      <button onClick={parseRawInput}>Import from Text</button>
      {questions.map((q,i) => (
        <div key={i} style={{ border: '1px solid #ccc', margin: '1rem 0', padding: '0.5rem' }}>
          <strong>{i+1}. {q.question}</strong>
          {q.choices.map((c,j) => (
            <div key={j}>{String.fromCharCode(65+j)}. {c}</div>
          ))}
        </div>
      ))}
      <button onClick={addQuestion}>Add Blank Question</button>
      <button onClick={generateIMSCC}>Download IMSCC</button>
      {zipUrl && <a href={zipUrl} download="quiz.imscc">Click to Download</a>}
    </div>
  );
}
