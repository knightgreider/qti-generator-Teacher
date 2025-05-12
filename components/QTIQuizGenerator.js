import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [zipUrl, setZipUrl] = useState("");

  // Parse input
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
        choices.push(line.replace(/^[*]?~/, '').trim());
        if (isCorrect) answerIndex = idx;
      });
      return { question: questionText, choices, answer: answerIndex };
    }).filter(Boolean);
    setQuestions(parsed);
  };

  // Generate IMSCC with a single QTI file
  const generateIMSCC = async () => {
    if (!title) { alert('Enter a quiz title'); return; }
    const zip = new JSZip();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2,8);
    const folder = zip.folder(resourceId);

    // Build QTI XML containing all items
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment title="${title}">
    <section ident="root_section">
${questions.map((q,i) => `      <item ident="q${i+1}" title="${q.question}">
        <presentation>
          <material><mattext texttype="text/plain">${q.question}</mattext></material>
          <response_lid ident="response${i+1}" rcardinality="Single">
            <render_choice>
${q.choices.map((c,j)=>`              <response_label ident="choice${j}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join("\n")}
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
    folder.file(`${resourceId}.xml`, qtiXml);

    // Root manifest
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

    // Placeholders
    ['context.xml','course_settings.xml','files_meta.xml','media_tracks.xml'].forEach(name=>{
      const t=name.split('.')[0]; zip.file(name,`<${t}/>`);
    });

    const blob=await zip.generateAsync({type:'blob'});
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{padding:'1rem',fontFamily:'sans-serif'}}>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Quiz Title" style={{width:'100%',marginBottom:8,padding:4}}/>
      <textarea value={rawInput} onChange={e=>setRawInput(e.target.value)} placeholder="MC:: ... or TF:: ..." style={{width:'100%',height:150,marginBottom:8}}/>
      <button onClick={parseRawInput} disabled={!rawInput}>Parse</button>
      {questions.length>0&&<button onClick={generateIMSCC} style={{marginLeft:8}}>Download .imscc</button>}
      {zipUrl&&<div><a href={zipUrl} download="quiz.imscc">Download IMSCC</a></div>}
    </div>
  );
}
