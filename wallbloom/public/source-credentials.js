export function credentialFields(auth,t){
 return auth==='client'?[['client_id','Client ID'],['client_secret','Client Secret']]:auth==='userKey'?[['user_id',t('siteUserId')],['api_key',t('sourceApiKey')]]:auth==='loginKey'?[['login',t('siteLogin')],['api_key',t('sourceApiKey')]]:auth==='key'?[['apiKey',t('sourceApiKey')]]:[];
}
export function credentialValue(auth,values){
 const fields=credentialFields(auth,k=>k),v=Object.fromEntries(fields.map(([key])=>[key,String(values[key]||'').trim()]));
 if(!Object.values(v).some(Boolean))return '';
 if(Object.values(v).some(x=>!x)||auth==='client'&&!/^\d{1,20}$/.test(v.client_id)||auth==='userKey'&&!/^\d{1,20}$/.test(v.user_id))throw Error('siteRequired');
 return auth==='key'?v.apiKey:JSON.stringify(v);
}
export const publicCredential=key=>['client_id','user_id','login'].includes(key);
