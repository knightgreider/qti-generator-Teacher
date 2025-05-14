import { useState } from "react";
import JSZip from "jszip";

export default function QTIQuizGenerator() {
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [zipUrl, setZipUrl] = useState("");
  const [downloadName, setDownloadName] = useState("quiz.imscc");

  // Parse raw input into question objects
  const parseRawInput = (input) => {
    const blocks = input
      .split(/\r?\n\r?\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    const parsed = blocks
      .map((block) => {
        const lines = block
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        // Aiken format
        const aikenAnswer = lines[lines.length - 1].match(/^ANSWER:\s*([A-Z])/i);
        if (aikenAnswer) {
          const questionText = lines[0];
          const choices = lines.slice(1, -1).map((l) => l.replace(/^[A-Z]\.\s*/, "").trim());
          const answerLetter = aikenAnswer[1].toUpperCase();
          const answerIndex = answerLetter.charCodeAt(0) - 65;
          return { type: "MC", question: questionText, choices, answer: answerIndex };
        }
        // Gift essay
        if (/^(.+?)\s*\{\s*\}/s.test(block)) {
          const q = block.replace(/\{\s*\}/s, '').trim();
          return { type: "ES", question: q, choices: [], answer: 0 };
        }
        // Prefixed formats
        const header = lines[0].match(/^(MC|TF|ES|ESSAY)::\s*(.+)$/i);
        if (header) {
          let type = header[1].toUpperCase();
          if (type === "ESSAY") type = "ES";
          const questionText = header[2].trim();
          let choices = [];
          let answerIndex = 0;
          if (type === "MC" || type === "TF") {
            lines.slice(1).forEach((line, idx) => {
              const isCorrect = line.startsWith("*~");
              const text = line.replace(/^[*]?~/, '').trim();
              choices.push(text);
              if (isCorrect) answerIndex = idx;
            });
          }
          return { type, question: questionText, choices, answer: answerIndex };
        }
        return null;
      })
      .filter(Boolean);
    return parsed;
  };

  // Generate IMSCC package
  const generateIMSCC = async () => {
    if (!title) { alert('Enter quiz title'); return; }
    const questions = parseRawInput(rawInput);
    if (questions.length === 0) { alert('No questions parsed'); return; }

    const zip = new JSZip();
    const resourceId = 'ccres' + Math.random().toString(36).substr(2, 8);
    const folder = zip.folder(resourceId);

    // Build QTI items
    const qtiItems = questions.map((q, i) => {
      const idx = i + 1;
      const isEssay = q.type === 'ES';
      let meta = `<qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>${isEssay ? 'cc.essay.v0p1' : (q.choices.length > 2 ? 'cc.multiple_choice.v0p1' : 'cc.true_false.v0p1')}</fieldentry></qtimetadatafield>`;
      if (isEssay) meta += `<qtimetadatafield><fieldlabel>qmd_computerscored</fieldlabel><fieldentry>No</fieldentry></qtimetadatafield>`;

      let pres;
      if (isEssay) {
        pres = `<presentation>
  <material><mattext texttype="text/html">${q.question}</mattext></material>
  <response_str rcardinality="Single" ident="response${idx}">
    <render_fib>
      <response_label ident="response${idx}_label" rshuffle="No"/>
    </render_fib>
  </response_str>
</presentation>`;
      } else {
        const choicesXml = q.choices.map((c,j) => `<response_label ident="choice${j+1}"><material><mattext texttype="text/plain">${c}</mattext></material></response_label>`).join('');
        pres = `<presentation>
  <material><mattext texttype="text/html">${q.question}</mattext></material>
  <response_lid ident="response${idx}" rcardinality="Single">
    <render_choice>${choicesXml}</render_choice>
  </response_lid>
</presentation>`;
      }

      const comp = isEssay ? '' : `<varequal respident="response${idx}">${q.answer+1}</varequal>`;
      const proc = `<resprocessing>
  <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
  <respcondition continue="No"><conditionvar>${comp}</conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
</resprocessing>`;

      return `<item ident="${idx}">
  <itemmetadata>${meta}</itemmetadata>
  ${pres}
  ${proc}
</item>`;
    }).join('');

    const qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${resourceId}" title="${title}">
    <qtimetadata>
      <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.exam.v0p1</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>qmd_assessmenttype</fieldlabel><fieldentry>Examination</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>qmd_scoretype</fieldlabel><fieldentry>Percentage</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
${qtiItems}
    </section>
  </assessment>
</questestinterop>`;

    folder.file(`${resourceId}.xml`, qti);

    // manifest
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
  <organizations><organization identifier="ORG1" structure="hierarchical"><item identifier="ITEM1" identifierref="${resourceId}"/></organization></organizations>
  <resources>
    <resource identifier="${resourceId}" type="imsqti_xmlv1p2" href="${resourceId}/${resourceId}.xml">
      <file href="${resourceId}/${resourceId}.xml"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    ['context.xml','course_settings.xml','files_meta.xml','media_tracks.xml'].forEach(name => {
      const tag = name.split('.')[0];
      zip.file(name, `<${tag}/>`);
    });

    const blob = await zip.generateAsync({type:'blob'});
    const safe = title.replace(/[^\w-]/g,'_')||'quiz';
    setDownloadName(`${safe}.imscc`);
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{padding:'1rem',fontFamily:'sans-serif'}}>
      <input placeholder="Quiz Title" value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%',marginBottom:8,padding:4}}/>
      <textarea placeholder="Paste questions separated by blank line" value={rawInput} onChange={e=>setRawInput(e.target.value)} style={{width:'100%',height:200,marginBottom:8}}/>
      <button onClick={generateIMSCC} disabled={!rawInput||!title}>Generate IMSCC</button>
      {zipUrl&&<div style={{marginTop:8}}><a href={zipUrl} download={downloadName}>Download IMSCC</a></div>}
    </div>
  );
}
