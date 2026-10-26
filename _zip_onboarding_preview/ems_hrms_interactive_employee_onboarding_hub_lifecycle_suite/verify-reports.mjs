import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
const {default:Page}=await compile('src/Reports.jsx');const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');
for(const value of ['Lifecycle Reports &amp; SLA Analytics','Core Engineering','624','href="#/reports"','Sample data'])if(!markup.includes(value))throw new Error('Missing '+value);
let slots=[],cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/Reports.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
function render(){cursor=0;return mod.exports.default();}function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=fn=>{const node=nodes(render()).find(fn);if(!node)throw new Error('Control missing');return node;};
const byId=id=>find(n=>n.props?.id===id);
render();byId('btn-payroll').props.onClick();if(byId('view-payroll').props.className.includes('hidden'))throw new Error('Report switch failed');
find(n=>n.props?.['aria-label']==='Search departments').props.onChange({target:{value:'Sales'}});
if(nodes(render()).filter(n=>n.type==='tr'&&n.key==='Global Sales').length!==1)throw new Error('Search failed');
find(n=>n.props?.['aria-label']==='Search departments').props.onChange({target:{value:''}});
find(n=>n.type==='button'&&n.props.onClick?.toString().includes('sortTable(1)')).props.onClick();
let departments=nodes(render()).filter(n=>n.type==='tr'&&n.key).map(n=>n.key);if(departments[0]!=='Product & Design')throw new Error('Sort failed');
byId('exportMenuBtn').props.onClick({stopPropagation(){}});if(byId('exportDropdown').props.className.includes('hidden'))throw new Error('Export menu failed');
find(n=>n.type==='button'&&n.props.onClick?.toString().includes('triggerExport')&&n.props.onClick.toString().includes('CSV')).props.onClick();if(!byId('toastMessage').props.children.includes('prototype'))throw new Error('Export feedback failed');
find(n=>n.props?.['aria-label']==='Analyze Q2 2024').props.onClick();if(byId('drillDownModal').props.className.includes('hidden'))throw new Error('Drilldown failed');
byId('notifyBtn').props.onClick();if(!byId('notifyBtn').props.disabled)throw new Error('Compliance preference failed');
for(const value of slots)if(value&&typeof value==='object'&&'current'in value)clearTimeout(value.current);
console.log('Passed: report render, report switching, department search/sorting, export menu/feedback, drilldown, and compliance preference.');
