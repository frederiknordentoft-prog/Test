import{E as e,H as t,c as n,l as r,o as i,r as a,s as o,t as s}from"./voice-Bs2YkWG8.js";var c=`
class LytRecorder extends AudioWorkletProcessor {
  constructor() {
    super()
    this.on = false
    this.chunks = []
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.chunks = [] }
      if (e.data === 'stop') { this.on = false; this.port.postMessage(this.chunks); this.chunks = [] }
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (this.on) this.chunks.push(ch ? ch.slice(0) : new Float32Array(128))
    return true
  }
}
registerProcessor('lyt-recorder', LytRecorder)
`,l=e=>new Promise(t=>setTimeout(t,e));async function u(t){let n=s(),a=r(t);await i(t).ended;let o=s(),c=o&&o!==n?o:null;return{text:a.text,clips:a.clips,texts:a.clips.map(e),planned:c?c.plan.clips.map(e=>e.id):[],plannedMs:c?c.plan.totalMs:0}}async function d(){let e=t();if(!e)throw Error(`Ingen Web Audio`);if(await e.ctx.resume(),e.ctx.state!==`running`)throw Error(`AudioContext kører ikke (${e.ctx.state})`);return e}async function f(e,t=700){let{ctx:n,voiceBus:r}=await d();await a(e);let i=URL.createObjectURL(new Blob([c],{type:`text/javascript`}));await n.audioWorklet.addModule(i);let o=new AudioWorkletNode(n,`lyt-recorder`,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]}),s=n.createGain();s.gain.value=0,r.connect(o),o.connect(s).connect(n.destination),o.port.postMessage(`start`);let f=n.currentTime;await l(200);let p=[],m=[];for(let r of e)m.push((n.currentTime-f)*1e3),p.push(await u(r)),await l(t);let h=await new Promise(e=>{o.port.onmessage=t=>e(t.data),o.port.postMessage(`stop`)});r.disconnect(o),o.disconnect();let g=h.reduce((e,t)=>e+t.length,0),_=new Uint8Array(g*2),v=new DataView(_.buffer),y=0;for(let e of h)for(let t=0;t<e.length;t++)v.setInt16(y,Math.max(-32768,Math.min(32767,Math.round(e[t]*32767))),!0),y+=2;let b=``;for(let e=0;e<_.length;e+=32768)b+=String.fromCharCode(..._.subarray(e,e+32768));return{sampleRate:n.sampleRate,pcm16:btoa(b),statements:p,startsMs:m}}function p(){window.__lyt={ready:()=>o(),say:async e=>(await d(),u(e)),record:f,status:()=>n()}}export{p as installE2E};