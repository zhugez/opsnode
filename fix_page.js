
import fs from 'fs';

const filePath = '/root/.openclaw/workspace/opsnode/src/app/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The file has a double return block because of a bad edit.
// I will find the first '</main>' and everything after it until the next 'function UnitPortrait'
// and replace it with the correct closing of the first main block.

const mainClosing = '</main>';
const portraitStart = 'function UnitPortrait';

const firstMainClosingIdx = content.indexOf(mainClosing);
const lastPortraitStartIdx = content.lastIndexOf(portraitStart);

if (firstMainClosingIdx !== -1 && lastPortraitStartIdx !== -1) {
  const head = content.substring(0, firstMainClosingIdx + mainClosing.length);
  const tail = content.substring(lastPortraitStartIdx);
  const fixedContent = head + '\n  );\n}\n\n' + tail;
  fs.writeFileSync(filePath, fixedContent);
  console.log('Fixed file');
} else {
  console.log('Could not find markers', { firstMainClosingIdx, lastPortraitStartIdx });
}
