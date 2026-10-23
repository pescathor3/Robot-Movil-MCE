
(()=>{
 const cover=document.getElementById('mceCover');
 const start=document.getElementById('mceStartAssembly');
 const preview=document.getElementById('mcePreviewCover');
 const coverImg=cover?.querySelector('.mceCoverImage');if(coverImg&&window.MCE_COVER_IMAGE)coverImg.src=window.MCE_COVER_IMAGE;
 function openCover(){
   const modal=document.getElementById('maintyModal');
   if(modal&&!modal.hidden){document.getElementById('maintyClose')?.click()}
   cover.hidden=false;
   start.focus({preventScroll:true});
 }
 function beginAssembly(){
   cover.hidden=true;
   document.getElementById('next')?.focus({preventScroll:true});
 }
 start.addEventListener('click',beginAssembly);
 if(preview)preview.addEventListener('click',openCover);
 window.MCE_SHOW_COVER=openCover;
})();
