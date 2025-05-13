import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse MC:: or TF:: formatted text into question objects
  const parseRawInput = () => {
    const blocks = rawInput.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean);
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

  // Generate IMSCC zip with a single composite QTI file matching Schoology export
  const generateIMSCC = async () => {
    if (!title) { alert('Enter quiz title'); return; }
    const zip = new JSZip();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // Build composite QTI XML
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/profile/cc/ccv1p2/ccv1p2_qtiasiv1p2p1_v1p0.xsd">
  <assessment ident="${resourceId}" title="${title}">
    <section ident="root_section">
${questions.map((q,i) => `      <item ident="${i+1}">
        <presentation>
          <material><mattext texttype="text/html">${q.question}</mattext></material>
          <response_lid ident="${i+1}" rcardinality="${q.choices.length > 2 ? 'Single' : 'Single'}">
            <render_choice>
${q.choices.map((c,j) => `              <response_label ident="${j+1}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("\n")}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No">
            <conditionvar><varequal respident="${i+1}">${q.answer+1}</varequal></conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`).join("\n")}
    </section>
  </assessment>
</questestinterop>`;
    folder.file(`${resourceId}.xml`, qtiXml);

    // Root manifest referencing the single QTI file
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
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
    zip.file('imsmanifest.xml', manifest);

    // Schoology required placeholders
    ['context.xml','course_settings.xml','files_meta.xml','media_tracks.xml'].forEach(name => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>`);
    });

    // Generate blob URL
    const blob = await zip.generateAsync({ type: 'blob' });
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <input
        placeholder="Quiz Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 4 }}
      />
      <textarea
        placeholder="Paste MC:: or TF:: formatted questions"
        value={rawInput}
        onChange={e => setRawInput(e.target.value)}
        style={{ width: '100%', height: 150, marginBottom: 8 }}
      />
      <button onClick={parseRawInput} disabled={!rawInput}>Parse</button>
      {questions.length > 0 && (
        <button onClick={generateIMSCC} style={{ marginLeft: 8 }}>Download .imscc</button>
      )}
      {zipUrl && <div style={{ marginTop: 8 }}><a href={zipUrl} download="quiz.imscc">Download IMSCC</a></div>}
    </div>
  );
}
