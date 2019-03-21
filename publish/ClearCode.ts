export function clearCode(code: string) {
    //清理多余的文件 
    // __extends=this&&this.__extends||function __extends(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i])};return function(e,i){function r(){this.constructor=e}t(e,i),e.prototype=null===i?Object.create(i):(r.prototype=i.prototype,new r)}}()
    //正则 __extends=this&&this\.__extends\|\|function\(\)\{.*?\}\}\(\)

    code = clearEgretDecorator(code);
    code = clearTSModule(code);
    code = getEgretDecorator() + code;
    code = oneUseStrict(code);
    return code;
}

export function getEgretDecorator() {
    return `if("undefined"==typeof global)var global=window;if("undefined"==typeof __global)var __global=global;var egret={},jy={};function __extends(t,e){function r(){this.constructor=t;}for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i]);r.prototype=e.prototype,t.prototype=new r();};function __reflect(t,e,i){t.__class__=e,i?i.push(e):i=[e],t.__types__=t.__types__?i.concat(t.__types__):i}function __define(t,e,i,r){Object.defineProperty(t,e,{configurable:!0,enumerable:!0,get:i,set:r})}function __decorate(e,t,n,i){var o,a=arguments.length,r=3>a?t:null===i?i=Object.getOwnPropertyDescriptor(t,n):i;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(e,t,n,i);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(r=(3>a?o(r):a>3?o(t,n,r):o(t,n))||r);return a>3&&r&&Object.defineProperty(t,n,r),r}`;
}

export function clearTSModule(code: string, modules = ["egret", "jy"]) {
    let m = modules.join("|");
    let reg = new RegExp(`var (${m});`, "g");
    let reg2 = new RegExp(`\\s*\\|\\|\\s*\\((${m})\\s*=\\s*\\{\\}\\)`, "g");
    return code.replace(reg, "").replace(reg2, "")
}

export function clearEgretDecorator(code: string) {
    return code.replace(/var __reflect=this&&this\.__reflect\|\|.*?,\w+;/g, "");
}

export function oneUseStrict(code: string) {
    if (code.search(/use strict/) > -1) {
        return code.replace(/("|')use strict\1;?/g, "");
    }
    return code;
}