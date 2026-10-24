import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {PaymentExport} from './payment-export';
import type {InvoiceFonts} from './invoice-pdf';

export function createPaymentLedgerPdf(data:PaymentExport,fonts:InvoiceFonts){
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.addFileToVFS('GoogleSans-Regular.ttf',fonts.regular);doc.addFont('GoogleSans-Regular.ttf','GoogleSans','normal');
 doc.addFileToVFS('GoogleSans-Bold.ttf',fonts.bold);doc.addFont('GoogleSans-Bold.ttf','GoogleSans','bold');
 doc.setFont('GoogleSans','bold');doc.setFontSize(21);doc.setTextColor('#181818');
 doc.text('HYBRID / Payment ledger',14,23);
 doc.setFont('GoogleSans','normal');doc.setFontSize(10);doc.setTextColor('#626262');
 // Long branch names wrap before the table rather than extending off the page.
 const scope:string[]=doc.splitTextToSize(`${data.branch}  |  Generated ${data.generated} (Asia/Kuala_Lumpur)`,269);
 doc.text(scope,14,33);
 const summaryY=39+(scope.length-1)*5;
 doc.setFont('GoogleSans','bold');doc.setTextColor('#181818');
 doc.text(`${data.rows.length} payment records    |    Total recorded: RM ${data.total.toFixed(2)}`,14,summaryY);
 doc.setFont('GoogleSans','normal');doc.setFontSize(9);
 const widths=[45,36,24,25,30,36,25,48];
 // Keep each table row shorter than a page. Auto-splitting very tall rows can lose other cells' wrapped text.
 const body=data.rows.flatMap(row=>{
  const values=[`${row.Member}\n${row['Member ID']}`,row.Membership,row['Amount (RM)'].toFixed(2),row['Payment date'],row.Method,row.Reference,row.Status,row.Notes];
  const lines:string[][]=values.map((value,index)=>doc.splitTextToSize(value||'',widths[index]-6));
  const parts=Math.max(1,Math.ceil(Math.max(...lines.map(value=>value.length))/16));
  return Array.from({length:parts},(_,part)=>lines.map((value,index)=>{
   const content=value.slice(part*16,(part+1)*16).join('\n');
   return index===0&&part>0&&!content?`${row['Member ID']}\n(continued)`:content;
  }));
 });
 autoTable(doc,{
  startY:summaryY+9,margin:{top:22,right:14,bottom:18,left:14},theme:'striped',rowPageBreak:'avoid',
  head:[['MEMBER','MEMBERSHIP','AMOUNT (RM)','DATE','METHOD','REFERENCE','STATUS','NOTES']],
  body,
  styles:{font:'GoogleSans',fontSize:9,cellPadding:3,textColor:'#242424',overflow:'linebreak',valign:'top'},
  headStyles:{fillColor:'#f0c92c',textColor:'#181818',fontStyle:'bold',fontSize:8},
  columnStyles:{0:{cellWidth:45},1:{cellWidth:36},2:{cellWidth:24,halign:'right'},3:{cellWidth:25},4:{cellWidth:30},5:{cellWidth:36},6:{cellWidth:25},7:{cellWidth:48}},
  didDrawPage:({pageNumber})=>{
   if(pageNumber>1){doc.setFont('GoogleSans','bold');doc.setFontSize(11);doc.setTextColor('#181818');doc.text('HYBRID / Payment ledger (continued)',14,14);}
  },
 });
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont('GoogleSans','normal');doc.setFontSize(8);doc.setTextColor('#626262');
  doc.text('Recorded amounts and statuses; this export does not change payment records.',14,201);
  doc.text(`${page} / ${pages}`,283,201,{align:'right'});
 }
 doc.setProperties({title:'Hybrid payment ledger',author:'Hybrid Combative Academy & Gym',subject:`Payment records - ${data.branch}`});
 return doc;
}
