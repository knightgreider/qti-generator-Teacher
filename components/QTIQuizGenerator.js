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

  // Generate IMSCC with separate QTI file per question and assessment_meta
  const generateIMSCC = async () => {
    if (!title) { alert('Enter quiz title'); return; }
    const zip = new JSZip();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // assessment_meta.xml listing item_refs
    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz ident="${resourceId}">
  <title>${title}</title>
  ${questions.map((_, idx) => `<item_ref linkrefid=\"q${idx+1}\" />`).join("\n  ")}
</quiz>`;
    folder.file('assessment_meta.xml', metaXml);

    // Create one .xml.qti per question
    questions.forEach((q, idx) => {
      const i = idx + 1;
      const qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident=\"q${i}\" title=\"Question ${i}\">
    <presentation>
      <material>
        <mattext texttype=\"text/plain\">${q.question}</mattext>
      </material>
      <response_lid ident=\"response${i}\" rcardinality=\"Single\">
        <render_choice>
${q.choices.map((c,j) => `          <response_label ident=\"choice${j}\"><material><mattext texttype=\"text/plain\">${c}</mattext></material></response_label>`).join("\n")}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes>
        <decvar varname=\"SCORE\" vartype=\"Decimal\" minvalue=\"0\" maxvalue=\"100\"/>
      </outcomes>
      <respcondition continue=\"No\">
        <conditionvar>
          <varequal respident=\"response${i}\">choice${q.answer}</varequal>
        </conditionvar>
        <setvar action=\"Set\">100</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
      folder.file(`q${i}.xml.qti`, qti);
    });

    // Build imsmanifest.xml
    const resources = questions.map((_, idx) => {
      const i = idx + 1;
      return `    <resource identifier=\"res_q${i}\" type=\"imsqti_xmlv1p2\" href=\"${resourceId}/q${i}.xml.qti\">\n      <file href=\"${resourceId}/q${i}.xml.qti\"/>\n    </resource>`;
    }).join("\n");

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier=\"MANIFEST1\"
    xmlns=\"http://www.imsglobal.org/xsd/imscp_v1p1\"
    xmlns:imsqti=\"http://www.imsglobal.org/xsd/imsqti_v1p2\"
    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
    xsi:schemaLocation=\"http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd\">
  <organizations>
    <organization identifier=\"ORG1\" structure=\"hierarchical\">
      <item identifier=\"ASSESS1\" identifierref=\"${resourceId}_assess\"/>
    </organization>
  </organizations>
  <resources>
${resources}
    <resource identifier=\"${resourceId}_assess\" type=\"imsqti_xmlv1p2\" href=\"${resourceId}/assessment_meta.xml\">\n      <file href=\"${resourceId}/assessment_meta.xml\"/>\n    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    // placeholders
    ['context.xml','course_settings.xml','files_meta.xml','media_tracks.xml'].forEach(n => {
      const tag = n.split('.')[0]; zip.file(n, `<${tag}/>`);
    });

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
      {zipUrl && (
        <div style={{ marginTop: 8 }}><a href={zipUrl} download="quiz.imscc">Download IMSCC</a></div>
      )}
    </div>
  );
}
