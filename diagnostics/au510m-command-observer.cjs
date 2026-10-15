'use strict';
// One transparent observer on the existing client. No socket writes, timers or retries.
function observe({owner,core,sourceFor=()=>null,onError=()=>{}}){
 let current=null,closed=false;const bindings=[];const originalSend=owner.send;
 const safely=fn=>{try{return fn();}catch{try{onError();}catch{}return null;}};
 function bind(){
  const radio=owner.radio;
  if(!radio||bindings.some(b=>b.radio===radio))return;
  const original=radio._sendRequest;if(typeof original!=='function')return;
  const own=Object.getOwnPropertyDescriptor(radio,'_sendRequest');
  function wrapped(request,callback){
   if(closed)return original.apply(this,arguments);
   const commandSeq=this.nextRequestSequenceNumber;
   const requestSeq=safely(()=>core.commandRequest(request,{...current,command_seq:commandSeq,command_source_module:current?'node-red-contrib-flexradio/flexradio-radio.js':'flexradio-js/Radio.js'}));
   // Exact callback closure + protocol sequence, independent of _msgid and timing.
   function response(message){
    if(!closed)safely(()=>core.commandAck(message,{request_seq:requestSeq,command_seq:commandSeq}));
    if(typeof callback==='function')return callback.apply(this,arguments);
   }
   return original.call(this,request,response);
  }
  radio._sendRequest=wrapped;bindings.push({radio,original,wrapped,own});
 }
 function send(msg){
  safely(bind);const previous=current;current=safely(()=>sourceFor(msg));
  try{return originalSend.apply(this,arguments);}finally{current=previous;}
 }
 owner.send=send;safely(bind);const connected=()=>safely(bind);owner.on('connected',connected);
 return {close(){closed=true;owner.off('connected',connected);if(owner.send===send)owner.send=originalSend;for(const b of bindings)if(b.radio._sendRequest===b.wrapped){if(b.own)Object.defineProperty(b.radio,'_sendRequest',b.own);else delete b.radio._sendRequest;}}};
}
module.exports={observe};
