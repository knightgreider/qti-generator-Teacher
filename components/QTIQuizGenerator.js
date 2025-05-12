import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse MC:: or TF:: formatted text into question objects
  const parseRawInput = () => {
    const blocks = rawInput.split(/\r?\n\s*\r?\n/)
      .map(b => b.trim())
      .filter(Boolean);
    const parsed = blocks.map(block => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const header = lines[0].match(/^(MC|TF)::\s*(.+)$/);
      if (!header) return null;
      const questionText = header[2];
      const choices = [];
      let answerIndex = 0;
      lines.slice(1).forEach((line, idx) => {
        const isCorrect = line.startsWith('*~');
        const text = line.replace(/^[*]?~/, '').trim();
        choices.push(text);
        if (isCorrect) answerIndex = idx;
      });
      return { question: questionText, choices, answer: answerIndex };
    }).filter(Boolean);
    setQuestions(parsed);
  };

  // Generate IMSCC package with single QTI file (assessment) per Schoology export
  const generateIMSCC = async () => {
    const zip = new JSZip();
    const firstLine = rawInput.split(/\r?\n/)[0] || "MC::Generated Quiz";
    const quizTitle = firstLine.replace(/^(MC|TF)::\s*/, '').trim();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // Build one QTI file including all questions
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment title="${quizTitle}">
    <section ident="root_section">
${questions.map((q, i) => `      <item ident="q${i+1}" title="Question ${i+1}">
        <presentation>
          <material>
            <mattext texttype="text/plain">${q.question}</mattext>
          </material>
          <response_lid ident="response${i+1}" rcardinality="Single">
            <render_choice>
${q.choices.map((c,j) => `              <response_label ident="choice${j}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("\n")}
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
      </item>`).join("\n")}
    </section>
  </assessment>
</questestinterop>`;
    folder.file(`${resourceId}.xml`, qtiXml);

    // Build root imsmanifest.xml
    const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST1"
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v1p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <organizations>
    <organization identifier="ORG1" structure="hierarchical">
      <item identifier="ITEM1" identifierref="${resourceId}"/>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${resourceId}" type="imsqti_xmlv1p2" href="${resourceId}/${resourceId}.xml">
      <file href="${resourceId}/${resourceId}.xml"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifestXml);

    // Add placeholder files
    ['context.xml', 'course_settings.xml', 'files_meta.xml', 'media_tracks.xml'].forEach(name => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>`);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <textarea
        style={{ width: '100%', height: 150, marginBottom: 8 }}
        placeholder="MC:: ... or TF:: ... blocks"
        value={rawInput}
        onChange={e => setRawInput(e.target.value)}
      />
      <button onClick={parseRawInput} disabled={!rawInput}>Import</button>

      {questions.length > 0 && (
        <div style={{ margin: '1rem 0' }}>
          {questions.map((q, i) => (
            <div key={i} style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
              <strong>{i+1}. {q.question}</strong>
              {q.choices.map((c,j) => <div key={j}>{String.fromCharCode(65+j)}. {c}</div>)}
            </div>
          ))}
          <button onClick={generateIMSCC}>Download .imscc</button>
        </div>
      )}

      {zipUrl && <a href={zipUrl} download="quiz.imscc">Download .imscc</a>}
    </div>
  );
}
