/* ================= EDIT MODE ================= */
let EDIT=false;
function setEdit(on){EDIT=on;document.body.classList.toggle('edit-on',on);$('editPill').hidden=!on;if(on){glitchAll();try{navigator.vibrate&&navigator.vibrate(18)}catch(e){}}}
$('editPill').onclick=()=>setEdit(false);
/* edit mode: long-press (touch) or right-click (mouse) on anything editable */
(function(){let t=null,sx=0,sy=0,fired=false,swallow=0;
  /* the tap that ends a long-press must not also tick/open the thing under the finger */
  ['click','pointerup','mouseup'].forEach(ev=>addEventListener(ev,e=>{if(Date.now()<swallow){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(ev==='click')swallow=0}},true));
  const EDITABLE='.it,.tr,.trk,.tgt,.blk,.panel,.exp,.row';
  const trigger=(target)=>{if(target.closest('input,textarea,select,#sheet,.drawer,.modal,#v-gym,#v-journal'))return false;if(!target.closest('#main'))return false;
    const wasOn=EDIT;if(!EDIT)setEdit(true);const row=target.closest('.it,.tr,.trk,.tgt,[data-key]');const ed=row&&row.querySelector('.ed,[data-edit],[data-editx],[data-tedit]');if(ed&&wasOn)ed.click();return true};
  addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const tg=e.target;sx=e.touches[0].clientX;sy=e.touches[0].clientY;fired=false;clearTimeout(t);t=setTimeout(()=>{fired=trigger(tg);if(fired)swallow=Date.now()+900},520)},{passive:true});
  addEventListener('touchmove',e=>{if(Math.hypot(e.touches[0].clientX-sx,e.touches[0].clientY-sy)>10)clearTimeout(t)},{passive:true});
  addEventListener('touchend',e=>{clearTimeout(t);if(fired){e.preventDefault();fired=false}});
  addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea'))return;if(trigger(e.target))e.preventDefault()});
})();

