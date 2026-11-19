/* ================= EDIT MODE ================= */
let EDIT=false;
/* editing is local: hold a thing to edit it; holding a section shows its add/delete controls until you tap away */
let EDSCOPE=null;
function setEdit(on,el){if(EDSCOPE)EDSCOPE.classList.remove('edit-on');EDSCOPE=null;EDIT=on;
  if(on){EDSCOPE=el||document.body;EDSCOPE.classList.add('edit-on');try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}}}
addEventListener('pointerdown',e=>{if(!EDIT)return;const t=e.target;if(!t.closest||t.closest('.modal,#modal,#sheet,.drawer,.ed,.addrow,.sdel,[data-edit],[data-editx],[data-tedit]'))return;
  if(EDSCOPE&&EDSCOPE!==document.body&&EDSCOPE.contains(t))return;setEdit(false)},true);
/* edit mode: long-press (touch) or right-click (mouse) on anything editable */
(function(){let t=null,sx=0,sy=0,fired=false,swallow=0;
  /* the tap that ends a long-press must not also tick/open the thing under the finger */
  ['click','pointerup','mouseup'].forEach(ev=>addEventListener(ev,e=>{if(Date.now()<swallow){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(ev==='click')swallow=0}},true));
  const EDITABLE='.it,.tr,.trk,.tgt,.blk,.panel,.exp,.row';
  const trigger=(target)=>{if(target.closest('input,textarea,select,#sheet,.drawer,.modal,#v-gym,#v-journal'))return false;if(!target.closest('#main'))return false;
    const row=target.closest('.it,.tr,.trk,.tgt,[data-key]');const ed=row&&row.querySelector('.ed,[data-edit],[data-editx],[data-tedit]');
    try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}
    if(ed){setEdit(false);ed.click();return true}
    const sc=target.closest('.blk,.panel,.exp,section')||document.body;setEdit(true,sc);return true};
  addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const tg=e.target;sx=e.touches[0].clientX;sy=e.touches[0].clientY;fired=false;clearTimeout(t);t=setTimeout(()=>{fired=trigger(tg);if(fired)swallow=Date.now()+900},520)},{passive:true});
  addEventListener('touchmove',e=>{if(Math.hypot(e.touches[0].clientX-sx,e.touches[0].clientY-sy)>10)clearTimeout(t)},{passive:true});
  addEventListener('touchend',e=>{clearTimeout(t);if(fired){e.preventDefault();fired=false}});
  addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea'))return;if(trigger(e.target))e.preventDefault()});
})();

