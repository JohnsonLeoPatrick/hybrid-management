'use client';
import {useEffect,useState} from 'react';
import {searchMemberIds} from '@/services/member-search';

export function useMemberSearch(query:string,branch:string,enabled:boolean){
 const key=JSON.stringify([query.trim(),branch]);
 const [result,setResult]=useState<{key:string;ids:Set<string>;error:string}|null>(null);
 const searching=enabled&&!!query.trim();
 useEffect(()=>{
  if(!searching)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   searchMemberIds(query,branch,controller.signal).then(ids=>{
    if(!controller.signal.aborted)setResult({key,ids:new Set(ids),error:''});
   }).catch(()=>{if(!controller.signal.aborted)setResult({key,ids:new Set(),error:'Member search failed. Change your search or try again.'});});
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,branch,key,searching]);
 return {ids:searching&&result?.key===key?result.ids:null,loading:searching&&result?.key!==key,error:searching&&result?.key===key?result.error:''};
}
