import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
for(const [file,expected] of [['src/Helpdesk.jsx',['Helpdesk &amp; Support Suite','#TK-4091','#TK-4075','of 4 tickets','href="#/helpdesk"']],['src/App.jsx',['Ananya Deshmukh','Showing 1-6 of 14 New Hires']],['src/HeadcountRequisitions.jsx',['Showing 1-7 of 7 Requisitions']],['src/CreateCourse.jsx',['Create Course Studio States']]]){const {default:Page}=await compile(file);const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');for(const value of expected)if(!markup.includes(value))throw new Error(file+' missing '+value);console.log(file+': render passed');}
// Exercise the page handlers with a minimal hook runner.
let slots=[],cursor=0;
const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/Helpdesk.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
const Page=mod.exports.default;
function render(){cursor=0;return Page();}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=predicate=>{const node=nodes(render()).find(predicate);if(!node)throw new Error('Control not found');return node;};
const click=text=>find(node=>node.type==='button'&&node.props.children===text).props.onClick();
const change=(placeholder,value)=>find(node=>node.props?.placeholder===placeholder).props.onChange({target:{value}});
render();
change('Search tickets by ID, subject, or employee...','Rohan');
if(nodes(render()).filter(node=>node.props?.ticket).length!==1)throw new Error('Search failed');
click('1. Default Roster');
change('Brief summary of the issue...','Test ticket');
change('Provide complete details, including relevant figures (e.g., INR amounts) or device IDs...','Test description');
click('Submit Ticket');
let row=find(node=>node.props?.ticket?.subject==='Test ticket');
row.props.onOpen(row.props.ticket.id);
change('Type your response here...','Test reply');click('Send Reply');
if(!slots[0][0].comments.some(comment=>comment.text==='Test reply'))throw new Error('Reply failed');
click('Resolve');change('Explain the fix or adjustment made...','Issue fixed');click('Confirm Resolution');
if(slots[0][0].status!=='Resolved')throw new Error('Resolution failed');
click('6. Empty State');if(!nodes(render()).some(node=>node.props?.children==='No Tickets Found'))throw new Error('Empty state failed');
click('1. Default Roster');if(nodes(render()).filter(node=>node.props?.ticket).length!==4)throw new Error('Reset failed');
clearTimeout(slots.at(-1)?.current);
console.log('Passed: search, ticket creation, reply, resolution, empty state, and reset interactions.');
