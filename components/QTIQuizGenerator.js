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

  // Generate IMSCC package with single QTI assessment file
  const generateIMSCC = async () => {
    const zip = new JSZip();
    const quizFolder = zip.folder("Quiz");

    // Build assessment.xml content (QTI 1.2)
    const assessmentXml = `<?xml version="1.0" encoding="UTF-8"?>
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
    quizFolder.file('assessment.xml', assessmentXml);

    // Build imsmanifest.xml
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
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
    <resource identifier="res_assess" type="imsqti_xmlv1p2" href="Quiz/assessment.xml">
      <file href="Quiz/assessment.xml"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    // Root placeholders
    ['context.xml','course_settings.xml','files_meta.xml','media_tracks.xml'].forEach(name => {
      zip.file(name, `<${name.replace(/\..+/, '')}/>`);
