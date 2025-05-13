import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse MC:: or TF:: formatted input into question objects
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

  // Generate IMSCC zip matching Schoology QTI structure
  const generateIMSCC = async () => {
    if (!title) { alert('Please enter a quiz title'); return; }
    const zip = new JSZip();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // Composite QTI XML with Schoology metadata and exact namespace
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/profile/cc/ccv1p2/ccv1p2_qtiasiv1p2p1_v1p0.xsd"><assessment ident="${resourceId}" title="${title}"><qtimetadata><qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.exam.v0p1</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>qmd_assessmenttype</fieldlabel><fieldentry>Examination</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>qmd_scoretype</fieldlabel><fieldentry>Percentage</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata><section ident="root_section">${questions.map((q,i) => {
  const idx = i + 1;
  return `<item ident="${idx}"><itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield></qtimetadata></itemmetadata><presentation><material><mattext texttype="text/html">${q.question}</mattext></material><response_lid ident="${idx}" rcardinality="Single"><render_choice>${q.choices.map((c,j)=>`<response_label ident="${j+1}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join('')}</render_choice></response_lid></presentation><resprocessing><outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes><respcondition continue="No"><conditionvar><varequal respident="${idx}">${q.answer+1}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition></resprocessing></item>`;
}).join('')}</section></assessment></questestinterop>`;
    folder.file(`${resourceId}.xml`, qtiXml);

    // Root imsmanifest.xml referencing the single QTI file
    const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
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

    // Schoology placeholder files
    ['context.xml', 'course_settings.xml', 'files_meta.xml', 'media_tracks.xml'].forEach(name => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>`);
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
      {zipUrl && <div style={{ marginTop: 8 }}><a href={zipUrl} download="quiz.imscc">Download IMSCC</a></div>}
    </div>
  );
}
