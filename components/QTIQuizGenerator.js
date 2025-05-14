import { useState } from 'react';
import JSZip from 'jszip';

export default function QTIQuizGenerator() {
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [zipUrl, setZipUrl] = useState('');

  // Parse raw Aiken/GIFT-style input with MC::, TF::, ES::, ESSAY::
  const parseRawInput = (input) =>
    input
      .split(/\r?\n\r?\n+/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const header = lines[0].match(/^(MC|TF|ES|ESSAY)::\s*(.+)$/i);
        if (!header) return null;
        let type = header[1].toUpperCase();
        if (type === 'ESSAY') type = 'ES';
        const question = header[2].trim();
        if (type === 'MC' || type === 'TF') {
          const choices = [];
          let answer = 0;
          lines.slice(1).forEach((ln, idx) => {
            const correct = ln.startsWith('*~');
            const text = ln.replace(/^[*]?~/, '').trim();
            choices.push(text);
            if (correct) answer = idx;
          });
          return { type, question, choices, answer };
        }
        return { type, question, choices: [], answer: 0 };
      })
      .filter(Boolean);

  const generateIMSCC = async () => {
    if (!title.trim()) return alert('Please provide a quiz title.');
    if (!rawInput.trim()) return alert('Please paste quiz questions.');
    const questions = parseRawInput(rawInput);
    if (!questions.length) return alert('No questions parsed. Check format.');

    const zip = new JSZip();
    const safeTitle = title.replace(/[^\w-]/g, '_') || 'quiz';
    const resourceId = 'ccres' + Math.random().toString(36).substring(2, 10);

    // Create folder and QTI XML
    const folder = zip.folder(resourceId);
    const itemsXML = questions.map((q, i) => {
      const id = i + 1;
      const profile = q.type === 'ES' ? 'cc.essay.v0p1' : 'cc.multiple_choice.v0p1';
      const meta = `<itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>${profile}</fieldentry></qtimetadatafield>${q.type==='ES'?'<qtimetadatafield><fieldlabel>qmd_computerscored</fieldlabel><fieldentry>No</fieldentry></qtimetadatafield>':''}</qtimetadata></itemmetadata>`;
      let pres = `<presentation><material><mattext texttype=\"text/html\">${q.question}</mattext></material>`;
      if (q.choices.length) {
        pres += `<response_lid ident=\"resp${id}\" rcardinality=\"Single\"><render_choice>` +
          q.choices.map((c, j) => `<response_label ident=\"choice${j}\"><material><mattext texttype=\"text/plain\">${c}</mattext></material></response_label>`).join('') +
          `</render_choice></response_lid>`;
      } else {
        pres += `<response_str ident=\"resp${id}\" rcardinality=\"Single\"/>`;
      }
      pres += `</presentation>`;
      let proc = `<resprocessing><outcomes><decvar varname=\"SCORE\" vartype=\"Decimal\" minvalue=\"0\" maxvalue=\"100\"/></outcomes>`;
      if (q.choices.length) {
        proc += `<respcondition continue=\"No\"><conditionvar><varequal respident=\"resp${id}\">choice${q.answer}</varequal></conditionvar><setvar action=\"Set\" varname=\"SCORE\">100</setvar></respcondition>`;
      } else {
        proc += `<respcondition continue=\"No\"><conditionvar><other/></conditionvar><setvar action=\"Set\" varname=\"SCORE\">0</setvar></respcondition>`;
      }
      proc += `</resprocessing>`;
      return `<item ident=\"${id}\" title=\"${q.question}\">${meta}${pres}${proc}</item>`;
    }).join('');

    const qti = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<questestinterop xmlns=\"http://www.imsglobal.org/xsd/ims_qtiasiv1p2\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/profile/cc/ccv1p2/ccv1p2_qtiasiv1p2p1_v1p0.xsd\">
  <assessment ident=\"${resourceId}\" title=\"${title}\">
    <section ident=\"root_section\">
      ${itemsXML}
    </section>
  </assessment>
</questestinterop>`;

    folder.file(`${resourceId}.xml`, qti);

    // IMS manifest with correct resource identifier
    const manifest = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<manifest identifier=\"MANIFEST_1\" xmlns=\"http://www.imsglobal.org/xsd/imscp_v1p1\">
  <organizations default=\"ORG1\">
    <organization identifier=\"ORG1\" structure=\"hierarchical\">
      <item identifier=\"ITEM_${resourceId}\" identifierref=\"${resourceId}\">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier=\"${resourceId}\" type=\"imsqti_xmlv1p2\" href=\"${resourceId}/${resourceId}.xml\">
      <file href=\"${resourceId}/${resourceId}.xml\"/>
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    // Placeholder metadata files for Schoology
    ['context.xml', 'course_settings.xml', 'files_meta.xml', 'media_tracks.xml'].forEach((f) => {
      const tag = f.split('.')[0];
      zip.file(f, `<${tag}/>`);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    setZipUrl(URL.createObjectURL(blob));
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <input
        placeholder="Quiz Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 4 }}
      />
      <textarea
        placeholder="Paste questions (MC::, TF::, ES::, ESSAY::) separated by blank line"
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        style={{ width: '100%', height: 200, marginBottom: 8 }}
      />
      <button onClick={generateIMSCC} disabled={!title || !rawInput}>
        Generate IMSCC
      </button>
      {zipUrl && (
        <a href={zipUrl} download={`${safeTitle}.imscc`} style={{ marginLeft: 8 }}>
          Download .imscc
        </a>
      )}
    </div>
  );
}
