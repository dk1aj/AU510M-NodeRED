'use strict';
// One transparent observer on the existing client. No socket writes, timers or retries.
function observe({owner,core,sourceFor=()=>null,onError=()=>{}}){
 let current=null,incoming=null,closed=false;const bindings=[];const originalSend=owner.send;
 const safely=fn=>{try{return fn();}catch{try{onError();}catch{}return null;}};
 function bind(){
  const radio=owner.radio;
  if(!radio||bindings.some(b=>b.radio===radio))return;
  const original=radio._sendRequest;if(typeof original!=='function')return;
  const own=Object.getOwnPropertyDescriptor(radio,'_sendRequest');
  function wrapped(request,callback){
   if(closed)return original.apply(this,arguments);
   const commandSeq=this.nextRequestSequenceNumber;
   const requestSeq=safely(()=>core.commandRequest(request,{...current,client_handle:typeof radio.client_handle==='string'||typeof radio.client_handle==='number'?radio.client_handle:null,source_ip:radio.connection?.localAddress??null,source_port:radio.connection?.localPort??null,command_seq:commandSeq,command_source_module:current?'node-red-contrib-flexradio/flexradio-radio.js':'flexradio-js/Radio.js'}));
   // Exact callback closure + protocol sequence, independent of _msgid and timing.
   function response(message){
    if(!closed)safely(()=>core.commandAck(message,{request_seq:requestSeq,command_seq:commandSeq}));
    if(typeof callback==='function')return callback.apply(this,arguments);
   }
   return original.call(this,request,response);
  }
  radio._sendRequest=wrapped;bindings.push({radio,key:'_sendRequest',original,wrapped,own});
  const receive=radio._receiveMessage;
  if(typeof receive==='function'){
   const ownReceive=Object.getOwnPropertyDescriptor(radio,'_receiveMessage');
   function receiveObserved(line){const previous=incoming;incoming=typeof line==='string'?line:null;try{return receive.apply(this,arguments);}finally{incoming=previous;}}
   radio._receiveMessage=receiveObserved;bindings.push({radio,key:'_receiveMessage',original:receive,wrapped:receiveObserved,own:ownReceive});
  }
 }
 function send(msg){
  safely(bind);const previous=current;current=safely(()=>sourceFor(msg));
  try{return originalSend.apply(this,arguments);}finally{current=previous;}
 }
 owner.send=send;safely(bind);const connected=()=>safely(bind);owner.on('connected',connected);
 return {statusEvidence:()=>incoming,close(){closed=true;owner.off('connected',connected);if(owner.send===send)owner.send=originalSend;for(const b of bindings)if(b.radio[b.key]===b.wrapped){if(b.own)Object.defineProperty(b.radio,b.key,b.own);else delete b.radio[b.key];}}};
}
module.exports={observe};
