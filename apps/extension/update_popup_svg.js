import fs from 'fs';
let svg = fs.readFileSync('/Users/mdayaanquadri/localRepo/LeetSensei/apps/extension/assets/icon.svg', 'utf8');
svg = svg.replace(/clip-path/g, 'clipPath')
         .replace(/fill-rule/g, 'fillRule')
         .replace(/stroke-width/g, 'strokeWidth')
         .replace(/stroke-linecap/g, 'strokeLinecap')
         .replace(/stroke-linejoin/g, 'strokeLinejoin')
         .replace(/xmlns:xlink/g, 'xmlnsXlink')
         .replace(/xml:space/g, 'xmlSpace')
         .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
         .replace(/xmlns:c2pa="[^"]*"/g, '')
         .replace(/<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>/g, '');

if (!svg.includes('className=')) {
    svg = svg.replace('<svg ', '<svg className="w-full h-full" ');
}

let content = fs.readFileSync('/Users/mdayaanquadri/localRepo/LeetSensei/apps/extension/src/popup.tsx', 'utf8');

const startMarker = '{/* Fallback Icon for Logged Out */}';
const endMarker = '</svg>';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + svg + content.substring(endIndex + endMarker.length);
    fs.writeFileSync('/Users/mdayaanquadri/localRepo/LeetSensei/apps/extension/src/popup.tsx', newContent);
    console.log("SVG Injected!");
} else {
    console.error("Markers not found");
}
