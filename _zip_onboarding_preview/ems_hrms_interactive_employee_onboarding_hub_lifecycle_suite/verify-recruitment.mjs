import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
const {default:Page}=await compile('src/RecruitmentDetail.jsx');
const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');
for(const value of ['Senior Backend Lead - Distributed Systems','Karthik Ramanathan','Ananya Deshmukh','Showing 5 of 5 applicants','href="#/recruitment-detail"'])if(!markup.includes(value))throw new Error('Missing '+value);
let slots=[],cursor=0;
const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/RecruitmentDetail.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
function render(){cursor=0;return mod.exports.default();}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=predicate=>{const n=nodes(render()).find(predicate);if(!n)throw new Error('Control missing');return n;};
const click=text=>find(n=>n.type==='button'&&typeof n.props.children==='string'&&n.props.children.trim()===text).props.onClick({});
render();
find(n=>n.props?.id==='applicant-search').props.onChange({target:{value:'Ananya'}});
if(nodes(render()).filter(n=>n.props?.item).length!==1)throw new Error('Search failed');
click('Reset Filters');
click('9. Bulk Bar');
if(nodes(render()).filter(n=>n.props?.item&&n.props.selected).length!==2)throw new Error('Bulk selection failed');
find(n=>n.type==='button'&&n.props.onClick?.toString().includes('applyBulkMove')&&n.props.onClick.toString().includes('Tech Round 1')).props.onClick({});
if(slots[1].slice(0,2).some(item=>item.stage!=='Tech Round 1'))throw new Error('Bulk move failed');
const row=find(n=>n.props?.item?.name==='Ananya Deshmukh');row.props.openCandidate(row.props.item.id);
if(!nodes(render()).some(n=>n.props?.id==='dossier-name'&&n.props.children==='Ananya Deshmukh'))throw new Error('Wrong dossier');
find(n=>n.type==='button'&&n.props.onClick?.toString().includes('advanceStageCandidate()')).props.onClick({});
if(slots[1].find(item=>item.name==='Ananya Deshmukh').stage!=='Offer Stage')throw new Error('Advance failed');
find(n=>n.props?.['aria-label']==='title').props.onChange({target:{value:'Updated requisition'}});
click('Save Changes');
if(!nodes(render()).some(n=>n.type==='h1'&&n.props.children==='Updated requisition'))throw new Error('Edit failed');
find(n=>n.type==='button'&&n.props.onClick?.toString().includes('confirmCloseJob()')).props.onClick({});
if(!nodes(render()).some(n=>n.props?.children==='Closed'))throw new Error('Close failed');
for(const value of slots)if(value&&typeof value==='object'&&'current'in value)clearTimeout(value.current);
console.log('Passed: recruitment render, five applicants, search, bulk selection and movement, correct dossier, candidate advancement, editing, and closure.');
