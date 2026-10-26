import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
const {default:Page}=await compile('src/Payroll.jsx');const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');
for(const value of ['Payroll Processing &amp; Statutory Compliance Suite','Aarav Sharma','EMP-1155','href="#/payroll"','Showing 4 of 4 sample employees'])if(!markup.includes(value))throw new Error('Missing '+value);
let slots=[],cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/Payroll.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
function render(){cursor=0;return mod.exports.default();}function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=fn=>{const node=nodes(render()).find(fn);if(!node)throw new Error('Control missing');return node;};const byId=id=>find(n=>n.props?.id===id);const change=(label,value)=>find(n=>n.props?.['aria-label']===label).props.onChange({target:{value}});const click=text=>find(n=>n.type==='button'&&typeof n.props.children==='string'&&n.props.children.trim()===text).props.onClick({});
render();change('Search payroll','Rohan');if(nodes(render()).filter(n=>n.props?.row).length!==1)throw new Error('Search failed');
const row=find(n=>n.props?.row?.id==='EMP-1120');row.props.onOpen(row.props.row.name,row.props.row.id);if(byId('drawerEmpName').props.children!=='Rohan Verma (EMP-1120)')throw new Error('Wrong payslip');
row.props.processRow(row.props.row.id);if(slots[0][2].status!=='Processed')throw new Error('Process failed');row.props.voidRow(row.props.row.id);if(slots[0][2].status!=='Voided')throw new Error('Void failed');
change('Search payroll','');change('Payroll department','Finance & Legal');if(nodes(render()).filter(n=>n.props?.row).length!==1)throw new Error('Department filter failed');
change('Payroll department','All Departments');find(n=>n.props?.['aria-label']==='Select all payroll rows').props.onChange({target:{checked:true}});if(slots[7].length!==4)throw new Error('Select all failed');
click('6. CEO Enabled');if(!byId('disburseBtn').props.disabled)throw new Error('Unfinalized disbursement should be disabled');
find(n=>n.props?.onClick?.toString().includes('triggerPreview()')).props.onClick({});find(n=>n.props?.onClick?.toString().includes('triggerFinal()')).props.onClick({});if(byId('disburseBtn').props.disabled)throw new Error('Simulation gate failed');
byId('disburseBtn').props.onClick({});if(!byId('toastDesc').props.children.includes('No funds'))throw new Error('Preview feedback failed');
click('8. Error Retry');if(byId('errorState').props.className.includes('hidden'))throw new Error('Error state failed');find(n=>n.props?.onClick?.toString().includes('retryConnection()')).props.onClick({});if(byId('tableView').props.className.includes('hidden'))throw new Error('Retry failed');
for(const value of slots)if(value&&typeof value==='object'&&'current'in value)clearTimeout(value.current);
console.log('Passed: payroll render, four records, search, department filtering, selection, correct payslip, process/void, preview/finalization gating, mock disbursement, and error recovery.');
