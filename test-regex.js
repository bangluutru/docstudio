const txt = 'class="text-[11px] text-xs text-[10px]"';
console.log("Old Regex:", txt.replace(/\btext-(xs|sm|base|lg|xl|[2-4]xl|\[\d+px\])\b/g, "MATCH"));
console.log("New Regex:", txt.replace(/\btext-(xs|sm|base|lg|xl|[2-9]xl|\[\d+px\])(?!\w)/g, "MATCH"));
