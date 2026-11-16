/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {pythonEnvironment} from './python-runtime';

it('supplies the installed certifi CA bundle without overriding an explicit trust configuration',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'coco-python-ca-'));
  try {
    const library=path.join(root,'.venv',process.platform==='win32'?'Lib':'lib/python3.12');
    const bundle=path.join(library,'site-packages/certifi/cacert.pem');
    fs.mkdirSync(path.dirname(bundle),{recursive:true});fs.writeFileSync(bundle,'fixture');
    expect(pythonEnvironment(root,{}).SSL_CERT_FILE).toBe(bundle);
    expect(pythonEnvironment(root,{SSL_CERT_FILE:'/custom/ca.pem'}).SSL_CERT_FILE).toBe('/custom/ca.pem');
    expect(pythonEnvironment(root,{}).PYTHONHTTPSVERIFY).toBeUndefined();
    fs.unlinkSync(bundle);
    expect(pythonEnvironment(root,{}).SSL_CERT_FILE).toBeUndefined();
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
