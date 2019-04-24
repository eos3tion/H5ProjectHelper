export function clearCode(code: string) {
    //清理多余的文件 
    // __extends=this&&this.__extends||function __extends(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i])};return function(e,i){function r(){this.constructor=e}t(e,i),e.prototype=null===i?Object.create(i):(r.prototype=i.prototype,new r)}}()
    //正则 __extends=this&&this\.__extends\|\|function\(\)\{.*?\}\}\(\)

    code = clearEgretDecorator(code);
    code = clearEgretReflect(code);
    code = clearTSModule(code);
    code = getEgretDecorator() + code;
    // code = oneUseStrict(code);
    return code;
}

export function getEgretDecorator() {
    return `if("undefined"==typeof global)var global=window;if("undefined"==typeof __global)var __global=global;var egret={},jy={};function __extends(t,e){function r(){this.constructor=t;}for(var i in e)e.hasOwnProperty(i)&&(t[i]=e[i]);r.prototype=e.prototype,t.prototype=new r();}function __decorate(e,t,n,i){var o,a=arguments.length,r=3>a?t:null===i?i=Object.getOwnPropertyDescriptor(t,n):i;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(e,t,n,i);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(r=(3>a?o(r):a>3?o(t,n,r):o(t,n))||r);return a>3&&r&&Object.defineProperty(t,n,r),r}`;
}

export function clearTSModule(code: string, modules = ["egret", "jy"]) {
    let m = modules.join("|");
    let reg = new RegExp(`var (${m});`, "g");
    let reg2 = new RegExp(`\\s*\\|\\|\\s*\\((${m})\\s*=\\s*\\{\\}\\)`, "g");
    return code.replace(reg, "").replace(reg2, "")
}

/**
 * 清理白鹭的Reflect
 * @param code 
 */
export function clearEgretReflect(code: string) {
    return code.replace(/(__reflect\()/g, "false&&$1");
}

export function clearEgretDecorator(code: string) {
    return code.replace(/var __reflect=this&&this\.__reflect.*?prototype=null===([a-z]+?)\?Object.create\(\1\):\(([a-z]+?)\.prototype=\1\.prototype,new \2\)\}\}\(\)(;|,)/g, (_, _1, _2, _3) => {
        if (_3 == ";") {
            return "";
        } else {
            return "var "
        }
    });
}

export function oneUseStrict(code: string) {
    if (code.search(/use strict/) > -1) {
        return `"use strict";` + code.replace(/("|')use strict\1;?/g, "");
    }
    return code;
}