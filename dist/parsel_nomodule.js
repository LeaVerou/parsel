var parsel=function(e){"use strict";const t={attribute:/\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(?<caseSensitive>[iIsS])?\s*)?\]/gu,id:/#(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,class:/\.(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,comma:/\s*,\s*/g,combinator:/\s*[\s>+~]\s*/g,"pseudo-element":/::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,"pseudo-class":/:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶+)\))?/gu,type:/(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu},n=new Set(["pseudo-class","pseudo-element"]),r=new Set([...n,"attribute"]),s=new Set(["combinator","comma"]),l=new Set(["not","is","where","has","matches","-moz-any","-webkit-any","nth-child","nth-last-child"]),o={"nth-child":/(?<index>[\dn+-]+)\s+of\s+(?<subtree>.+)/};l["nth-last-child"]=o["nth-child"];const i=Object.assign({},t);function u(e,t){let n="",r=[];for(;t<e.length;t++){let s=e[t];if("("===s)r.push(s);else if(")"===s){if(!(r.length>0))throw new Error("Closing paren without opening paren at "+t);r.pop()}if(n+=s,0===r.length)return n}throw new Error("Opening paren without closing paren")}function a(e,t){if(!e)return[];var n=[e];for(var r in t){let e=t[r];for(var l=0;l<n.length;l++){var o=n[l];if("string"==typeof o){e.lastIndex=0;var i=e.exec(o);if(i){let e=i.index-1,t=[],s=i[0],u=o.slice(0,e+1);u&&t.push(u),t.push({type:r,content:s,...i.groups});let a=o.slice(e+s.length+1);a&&t.push(a),n.splice(l,1,...t)}}}}let u=0;for(let e=0;e<n.length;e++){let t=n[e],r=t.length||t.content.length;"object"==typeof t&&(t.pos=[u,u+r],s.has(t.type)&&(t.content=t.content.trim()||" ")),u+=r}return n}function c(e){if(!e)return null;e=e.trim();let s=[];e=e.replace(/(['"])(\\\1|.)+?\1/g,((e,t,n,r)=>(s.push({str:e,start:r}),t+"§".repeat(n.length)+t)));let l,o=[],c=0;for(;(l=e.indexOf("(",c))>-1;){let t=u(e,l);o.push({str:t,start:l}),e=e.substring(0,l)+"("+"¶".repeat(t.length-2)+")"+e.substring(l+t.length),c=l+t.length}let p=a(e,t);function f(e,t,n){for(let r of e)for(let e of p)if(n.has(e.type)&&e.pos[0]<r.start&&r.start<e.pos[1]){let n=e.content;if(e.content=e.content.replace(t,r.str),e.content!==n){i[e.type].lastIndex=0;let t=i[e.type].exec(e.content).groups;Object.assign(e,t)}}}return f(o,/\(¶+\)/,n),f(s,/(['"])§+?\1/,r),p}function p(e,{list:t=!0}={}){if(t&&e.find((e=>"comma"===e.type))){let t=[],n=[];for(let r=0;r<e.length;r++)if("comma"===e[r].type){if(0===n.length)throw new Error("Incorrect comma at "+r);t.push(p(n,{list:!1})),n.length=0}else n.push(e[r]);if(0===n.length)throw new Error("Trailing comma");return t.push(p(n,{list:!1})),{type:"list",list:t}}for(let t=e.length-1;t>=0;t--){let n=e[t];if("combinator"===n.type){let r=e.slice(0,t),s=e.slice(t+1);return{type:"complex",combinator:n.content,left:p(r),right:p(s)}}}return 0===e.length?null:1===e.length?e[0]:{type:"compound",list:[...e]}}function f(e,t,n,r){if(e){if("complex"===e.type)f(e.left,t,n,e),f(e.right,t,n,e);else if("compound"===e.type)for(let r of e.list)f(r,t,n,e);else e.subtree&&n&&n.subtree&&f(e.subtree,t,n,e);t(e,r)}}function g(e,{recursive:t=!0,list:n=!0}={}){let r=c(e);if(!r)return null;let s=p(r,{list:n});return t&&f(s,(e=>{if("pseudo-class"===e.type&&e.argument&&l.has(e.name)){let t=e.argument;const n=o[e.name];if(n){const r=n.exec(t);if(!r)return;Object.assign(e,r.groups),t=r.groups.subtree}t&&(e.subtree=g(t,{recursive:!0,list:!0}))}})),s}function h(e,t){return t=t||Math.max(...e)+1,e[0]*t**2+e[1]*t+e[2]}return i["pseudo-element"]=RegExp(t["pseudo-element"].source.replace("(?<argument>¶+)","(?<argument>.+?)"),"gu"),i["pseudo-class"]=RegExp(t["pseudo-class"].source.replace("(?<argument>¶+)","(?<argument>.+)"),"gu"),e.RECURSIVE_PSEUDO_CLASSES=l,e.RECURSIVE_PSEUDO_CLASSES_ARGS=o,e.TOKENS=t,e.TRIM_TOKENS=s,e.gobbleParens=u,e.nestTokens=p,e.parse=g,e.specificity=function e(t,{format:n="array"}={}){let r="object"==typeof t?t:g(t,{recursive:!0});if(!r)return null;if("list"===r.type){let t=10,n=r.list.map((n=>{let r=e(n);return t=Math.max(t,...r),r})),s=n.map((e=>h(e,t)));return n[function(e){let t=e[0],n=0;for(let r=0;r<e.length;r++)e[r]>t&&(n=r,t=e[r]);return 0===e.length?-1:n}(s)]}let s=[0,0,0];return f(r,(t=>{if("id"===t.type)s[0]++;else if("class"===t.type||"attribute"===t.type)s[1]++;else if("type"===t.type&&"*"!==t.content||"pseudo-element"===t.type)s[2]++;else if("pseudo-class"===t.type&&"where"!==t.name)if(l.has(t.name)&&t.subtree){e(t.subtree).forEach(((e,t)=>s[t]+=e))}else s[1]++})),s},e.specificityToNumber=h,e.tokenize=c,e.tokenizeBy=a,e.walk=f,Object.defineProperty(e,"__esModule",{value:!0}),e}({});
