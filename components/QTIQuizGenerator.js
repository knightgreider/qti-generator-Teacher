import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse MC:: or TF:: formatted text into question objects
  const parseRawInput = () => {
    const blocks = rawInput.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
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

  // Generate IMSCC package mirroring Canvas structure
  const generateIMSCC = async () => {
    const zip = new JSZip();
    const quizTitle = "Generated Quiz";
    const folder = zip.folder(quizTitle);

    // Create assessment_meta.xml inside quiz folder
    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz ident="generated_quiz">
  <title>${quizTitle}</title>
  ${questions.map((_, i) => `<item_ref linkrefid=\"q${i+1}\" />`).join("\n  ")}
</quiz>`;
    folder.file('assessment_meta.xml', metaXml);

    // Create one .xml.qti file per question
    questions.forEach((q, i) => {
      const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="q${i+1}" title="Question ${i+1}">
    <presentation>
      <material>
        <mattext texttype="text/plain">${q.question}</mattext>
      </material>
      <response_lid ident="response${i+1}" rcardinality="Single">
        <render_choice>
${q.choices.map((c,j) => `          <response_label ident=\"choice${j}\"><material><mattext texttype=\"text/plain\">${c}</mattext></material></response_label>`).join("\n")}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes>
        <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
      </outcomes>
      <respcondition continue="No">
        <conditionvar>
          <varequal respident=\"response${i+1}\">choice${q.answer}</varequal>
        </conditionvar>
        <setvar action=\"Set\">100</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
      folder.file(`q${i+1}.xml.qti`, qtiXml);
    });

    // Build root imsmanifest.xml referencing quiz folder
    const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST1"
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v1p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <organizations>
    <organization identifier="ORG1" structure="hierarchical">
      <item identifier="ITEM1" identifierref="res_assess"/>
    </organization>
  </organizations>
  <resources>
${questions.map((_, i) => `    <resource identifier=\"res_q${i+1}\" type=\"imsqti_xmlv1p2\" href=\"${quizTitle}/q${i+1}.xml.qti\">\n      <file href=\"${quizTitle}/q${i+1}.xml.qti\"/>\n    </resource>`).join("\n")}
    <resource identifier="res_assess" type="imsqti_xmlv1p2" href="${quizTitle}/assessment_meta.xml">
      <file href="${quizTitle}/assessment_meta.xml"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifestXml);

    // Add required placeholder files at root
    ['context.xml', 'course_settings.xml', 'files_meta.xml', 'media_tracks.xml'].forEach(name => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>`);
    });

    // Generate ZIP blob and URL
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
              {q.choices.map((c, j) => <div key={j}>{String.fromCharCode(65+j)}. {c}</div>)}
            </div>
          ))}
          <button onClick={generateIMSCC}>Download .imscc</button>
        </div>
      )}

      {zipUrl && <a href={zipUrl} download="quiz.imscc">Download .imscc</a>}
    </div>
  );
}
