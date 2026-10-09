'use strict';
// Incremental ZIP (STORE) with CRC32 and data descriptors; four fixed entries, no dependencies.
const fs=require('node:fs');
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
class Zip {
 constructor(file,maxBytes){this.fd=fs.openSync(file,'wx',0o600);this.offset=0;this.entries=[];this.maxBytes=maxBytes;}
 write(b){if(this.offset+b.length>this.maxBytes)throw Error('EXPORT_TOO_LARGE');let n=0;while(n<b.length)n+=fs.writeSync(this.fd,b,n,b.length-n);this.offset+=b.length;}
 entry(name,chunks){const start=this.offset,label=Buffer.from(name),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,6);h.writeUInt16LE(33,12);h.writeUInt16LE(label.length,26);this.write(h);this.write(label);let crc=0xffffffff,size=0;
  for(const chunk of chunks){const b=Buffer.from(chunk);for(const byte of b)crc=(crc>>>8)^table[(crc^byte)&255];size+=b.length;this.write(b);}
  crc=(crc^0xffffffff)>>>0;const d=Buffer.alloc(16);d.writeUInt32LE(0x08074b50);d.writeUInt32LE(crc,4);d.writeUInt32LE(size,8);d.writeUInt32LE(size,12);this.write(d);this.entries.push({label,start,crc,size});
 }
 finish(){const start=this.offset;for(const e of this.entries){const h=Buffer.alloc(46);h.writeUInt32LE(0x02014b50);h.writeUInt16LE(20,4);h.writeUInt16LE(20,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,14);h.writeUInt32LE(e.crc,16);h.writeUInt32LE(e.size,20);h.writeUInt32LE(e.size,24);h.writeUInt16LE(e.label.length,28);h.writeUInt32LE(e.start,42);this.write(h);this.write(e.label);}const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(this.entries.length,8);end.writeUInt16LE(this.entries.length,10);end.writeUInt32LE(this.offset-start,12);end.writeUInt32LE(start,16);this.write(end);fs.fsyncSync(this.fd);this.close();return this.offset;}
 close(){if(this.fd!==null){fs.closeSync(this.fd);this.fd=null;}}
}
module.exports={Zip};
