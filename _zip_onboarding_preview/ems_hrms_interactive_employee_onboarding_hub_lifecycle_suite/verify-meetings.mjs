import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
const {default:Page}=await compile('src/OneOnOnes.jsx');const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');
for(const value of ['One-on-One Meetings Suite','Quarterly Career &amp; Growth Sync','Design System Token Governance','href="#/one-on-one-meetings"','October 2025'])if(!markup.includes(value))throw new Error('Missing '+value);
let slots=[],cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/OneOnOnes.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
function render(){cursor=0;return mod.exports.default();}function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=fn=>{const node=nodes(render()).find(fn);if(!node)throw new Error('Control missing');return node;};const change=(label,value)=>find(n=>n.props?.['aria-label']===label).props.onChange({target:{value}});const click=text=>find(n=>n.type==='button'&&typeof n.props.children==='string'&&n.props.children.trim()===text).props.onClick({});
render();change('participant','Test Participant');change('date','2026-11-10');change('time','12:30');click('Schedule Meeting');
if(slots[3].length!==4||slots[5]!=='2026-11-10')throw new Error('Schedule failed');
const calendar=find(n=>n.props?.onReschedule&&n.props?.selectedDate);calendar.props.onOpen(4);
change('Meeting notes','Test local notes');if(slots[3].at(-1).notes!=='Test local notes')throw new Error('Notes failed');
change('New action item','Draft project plan');find(n=>n.props?.onClick?.toString().includes('addActionItem()')).props.onClick({});if(slots[3].at(-1).actions[0].text!=='Draft project plan')throw new Error('Action add failed');
find(n=>n.props?.onChange?.toString().includes('toggleAction')).props.onChange();if(!slots[3].at(-1).actions[0].done)throw new Error('Action toggle failed');
change('newDate','2026-11-11');change('newTime','13:00');click('Confirm Reschedule');if(slots[3].at(-1).date!=='2026-11-11')throw new Error('Reschedule failed');
change('Cancellation reason','Unavailable');click('Yes, Cancel Meeting');if(slots[3].at(-1).status!=='Cancelled')throw new Error('Cancel failed');
calendar.props.onOpen(1);find(n=>n.props?.onClick?.toString().includes('markAsDone()')).props.onClick({});if(slots[3][0].status!=='Completed')throw new Error('Completion failed');
for(const value of slots)if(value&&typeof value==='object'&&'current'in value)clearTimeout(value.current);
console.log('Passed: meetings render, scheduling, selected-date updates, correct meeting selection, notes, action creation/completion, rescheduling, cancellation, and meeting completion.');
