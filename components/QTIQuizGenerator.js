import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse MC:: or TF:: formatted text into question objects
  const parseRawInput = () => {
    const blocks = rawInput.split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const parsed = blocks
      .map((block) => {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
      })
      .filter(Boolean);
    setQuestions(parsed);
  };

  // Generate IMSCC package matching Schoology's structure
  const generateIMSCC = async () => {
    const zip = new JSZip();
    const quizTitle = rawInput.split(/
?
/)[0].slice(4).trim() || 'Generated Quiz';
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // Build assessment_meta.xml inside resource folder
    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz ident="${resourceId}">
  <title>${quizTitle}</title>
  ${questions.map((_, i) => `<item_ref linkrefid="q${i+1}" />`).join("
  ")}
</quiz>`;
    folder.file('assessment_meta.xml', metaXml);

    // Build each question as its own .xml.qti
    questions.forEach((q, i) => {
      const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="q${i+1}" title="Question ${i+1}">
    <presentation>
      <material>
        <mattext texttype="text/plain">${q.question}</mattext>
      </material>
      <response_lid ident="response${i+1}" rcardinality="Single">
        <render_choice>
${q.choices.map((c,j) => `          <response_label ident="choice${j}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("
")}
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
      folder.file(`q${i+1}.xml.qti`, itemXml);
    });

    // Build root imsmanifest.xml referencing each resource
    const resourcesXml = questions.map((_, i) => `    <resource identifier="res_q${i+1}" type="imsqti_xmlv1p2" href="${resourceId}/q${i+1}.xml.qti">
      <file href="${resourceId}/q${i+1}.xml.qti"/>
    </resource>`).join("
");
    const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST1"
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v1p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <organizations>
    <organization identifier="ORG1" structure="hierarchical">
      <item identifier="ASSESS1" identifierref="${resourceId}_assess"/>
    </organization>
  </organizations>
  <resources>
${resourcesXml}
    <resource identifier="${resourceId}_assess" type="imsqti_xmlv1p2" href="${resourceId}/assessment_meta.xml">
      <file href="${resourceId}/assessment_meta.xml"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifestXml);

    // Add Schoology placeholder files
    ['context.xml', 'course_settings.xml', 'files_meta.xml', 'media_tracks.xml'].forEach((name) => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>');
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    setZipUrl(URL.createObjectURL(blob));
  };

  // End of component logic

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      {/* ... UI unchanged ... */}
    </div>
  );
}
