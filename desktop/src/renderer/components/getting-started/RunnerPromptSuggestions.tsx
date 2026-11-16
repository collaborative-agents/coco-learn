import { useState } from 'react';
import { runnerSuggestedPrompts } from '../../../shared/runner-tutorial';
import './RunnerPromptSuggestions.css';

export default function RunnerPromptSuggestions({ onChoose, disabled = false }: {onChoose:(text:string)=>void;disabled?:boolean}) {
  const [notice,setNotice] = useState('');
  return <section className="runner-prompt-suggestions" aria-label="Game ideas">
    <span className="runner-prompt-heading">A few ideas to get you started</span>
    <div className="runner-prompt-list">{runnerSuggestedPrompts.map((prompt,index)=><div className="runner-prompt-card" key={prompt}>
      <button type="button" className="runner-prompt-use" data-runner-prompt={index} disabled={disabled} onClick={()=>onChoose(prompt)}>
        <span>{prompt}</span><span aria-hidden="true">↗</span>
      </button>
      <button type="button" className="runner-prompt-copy" aria-label={`Copy prompt: ${prompt}`} disabled={disabled} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setNotice('Copied!');}catch{setNotice('Couldn’t copy. Click the prompt to add it to your message.');}}}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M12 4V3H3v9h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>)}</div>
    {notice&&<span className="runner-prompt-notice" role="status">{notice}</span>}
  </section>;
}
