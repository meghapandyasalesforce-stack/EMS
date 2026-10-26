import fs from 'node:fs';
import path from 'node:path';
import {transform} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
async function compile(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=fs.readFileSync(file,'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g))await compile(path.resolve(path.dirname(file),m[1]));const {code}=await transform(source,{loader:file.endsWith('.jsx')?'jsx':'js',jsx:'automatic',format:'cjs'});const mod={exports:{}};new Function('require','module','exports',code)(name=>name.startsWith('./')?cache.get(path.resolve(path.dirname(file),name)):require(name),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const React=require('react'),{renderToString}=require('react-dom/server');
const {default:Page}=await compile('src/OnboardingDetail.jsx');const markup=renderToString(React.createElement(Page)).replace(/<!--.*?-->/g,'');
for(const value of ['Ananya Deshmukh','EMP-2025-091','85%','17/20','href="#/onboarding-detail"'])if(!markup.includes(value))throw new Error('Missing '+value);
let slots=[],cursor=0;const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(){const i=cursor++;return slots[i]??(slots[i]={current:null});},useEffect(){}};
const {code}=await transform(fs.readFileSync('src/OnboardingDetail.jsx','utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='react'?hooks:name.startsWith('./')?cache.get(path.resolve('src',name)):require(name),mod,mod.exports);
function render(){cursor=0;return mod.exports.default();}function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const find=fn=>{const node=nodes(render()).find(fn);if(!node)throw new Error('Control missing');return node;};const byId=id=>find(n=>n.props?.id===id);const action=name=>find(n=>n.props?.onClick?.toString().includes(name+'(')).props.onClick({});const change=(id,value)=>byId(id).props.onChange({target:{value}});
render();byId('btn-pause-toggle').props.onClick({});if(byId('badge-status').props.children!=='Paused')throw new Error('Pause failed');byId('btn-pause-toggle').props.onClick({});
find(n=>n.props?.['data-tab-btn']==='tasks').props.onClick({});if(byId('tab-tasks').props.className.includes('hidden'))throw new Error('Tabs failed');
change('new-task-title','Test induction task');action('submitNewTask');if(byId('task-total-count').props.children!==21)throw new Error('Task add failed');
find(n=>n.type==='input'&&n.props?.onChange?.toString().includes('Architecture Walkthrough')).props.onChange({currentTarget:{checked:true}});if(byId('task-completed-count').props.children!==18)throw new Error('Task progress failed');
change('quick-note-input','Safe note <script>literal text</script>');action('postQuickNote');if(!slots[7].some(note=>note.text.includes('literal text')))throw new Error('Note failed');
change('goal-title-input','Test milestone');action('submitNewGoal');if(!slots[8].some(goal=>goal.title==='Test milestone'))throw new Error('Goal failed');
action('confirmCourseAssignment');if(slots[9].length!==1)throw new Error('Course assignment failed');
action('verifyDoc');if(byId('badge-doc-form11').props.children!=='Verified')throw new Error('Document verification failed');
change('cancel-reason-select','Candidate withdrew');action('executeCancelOnboarding');if(byId('badge-status').props.children!=='Cancelled')throw new Error('Cancellation failed');
for(const value of slots)if(value&&typeof value==='object'&&'current'in value)clearTimeout(value.current);
console.log('Passed: dossier render, initial 17/20 progress, tabs, pause/resume, task creation/completion, safe notes, goals, course assignment, document verification, and cancellation.');
