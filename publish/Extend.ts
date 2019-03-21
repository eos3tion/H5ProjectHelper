
interface Date {
    /**
     * 格式化日期
     * 
     * @param {string} mask 时间字符串
     * @returns {string} 格式化后的时间
     */
    format(mask: string): string;
}

/**
 * 格式化日期
 */
Date.prototype.format = function (mask: string) {
    var d = this;
    var zeroize = function (value: any, length?: number) {
        if (!length) length = 2;
        value = String(value);
        for (var i = 0, zeros = ''; i < (length - value.length); i++) {
            zeros += '0';
        }
        return zeros + value;

    };
    return mask.replace(/"[^"]*"|'[^']*'|(?:d{1,4}|m{1,4}|yy(?:yy)?|([hHMstT])\1?|[lLZ])/g, function ($0) {

        switch ($0) {

            case 'd': return d.getDate();

            case 'dd': return zeroize(d.getDate());

            case 'ddd': return ['Sun', 'Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat'][d.getDay()];

            case 'dddd': return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];

            case 'M': return d.getMonth() + 1;

            case 'MM': return zeroize(d.getMonth() + 1);

            case 'MMM': return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];

            case 'MMMM': return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()];

            case 'yy': return String(d.getFullYear()).substr(2);

            case 'yyyy': return d.getFullYear();

            case 'h': return d.getHours() % 12 || 12;

            case 'hh': return zeroize(d.getHours() % 12 || 12);

            case 'H': return d.getHours();

            case 'HH': return zeroize(d.getHours());

            case 'm': return d.getMinutes();

            case 'mm': return zeroize(d.getMinutes());

            case 's': return d.getSeconds();

            case 'ss': return zeroize(d.getSeconds());

            case 'l': return zeroize(d.getMilliseconds(), 3);

            case 'L': {
                var m = d.getMilliseconds();

                if (m > 99) m = Math.round(m / 10);

                return zeroize(m);
            }

            case 'tt': return d.getHours() < 12 ? 'am' : 'pm';

            case 'TT': return d.getHours() < 12 ? 'AM' : 'PM';

            case 'Z': return d.toUTCString().match(/[A-Z]+$/);

            // Return quoted strings with the surrounding quotes removed      

            default: return $0.substr(1, $0.length - 2);

        }

    });
};

interface String {
    substitute(...args): string;
    /**
     * 将一个字符串转换成一个很小几率重复的数值  
     * <font color="#ff0000">此方法hash的字符串并不一定唯一，慎用</font>
     */
    hash(): number;
}

/**
 * 替换字符串中{0}{1}{2}{a} {b}这样的数据，用obj对应key替换，或者是数组中对应key的数据替换
 */
String.prototype.substitute = function () {
    var len = arguments.length;
    if (len > 0) {
        var obj;
        if (len == 1) {
            obj = arguments[0];
            if (typeof obj !== "object") {
                obj = arguments;
            }
        } else {
            obj = arguments;
        }

        if ((obj instanceof Object) && !(obj instanceof RegExp)) {
            return this.replace(/\{([^{}]+)\}/g, function (_, key) {
                var value = obj[key];
                return (value !== undefined) ? '' + value : '';
            });
        }
    }
    return this;
}

String.prototype.hash = function () {
    var len = this.length;
    var hash = 5381;
    for (var i = 0; i < len; i++) {
        hash += (hash << 5) + this.charCodeAt(i);
    }
    return hash & 0xffffffff;
}

interface JSON {
    /**
     * 用于最小化空白区域和注释
     * 由于JSON.parse本身不支持注释，所以配置文件，需要先使用此方法消除注释，或者直接使用扩展的parse2
     * 
     * @param {string} json json字符串
     * @returns {string} 去掉空白和注释的标准JSON
     */
    minify(json: string): string;

    /**
     * 等价于JSON.parse(JSON.minify(json))
     * 
     * @param {string} json json字符串
     * @returns {*}
     */
    parse2(json: string): any;
}

JSON.minify = function (json) {

    var tokenizer = /"|(\/\*)|(\*\/)|(\/\/)|\n|\r/g,
        in_string = false,
        in_multiline_comment = false,
        in_singleline_comment = false,
        tmp, tmp2, new_str = [], ns = 0, from = 0, lc: string, rc: string;

    tokenizer.lastIndex = 0;

    while (tmp = tokenizer.exec(json)) {
        lc = RegExp["$`"];
        rc = RegExp["$'"];
        if (!in_multiline_comment && !in_singleline_comment) {
            tmp2 = lc.substring(from);
            if (!in_string) {
                tmp2 = tmp2.replace(/(\n|\r|\s)*/g, "");
            }
            new_str[ns++] = tmp2;
        }
        from = tokenizer.lastIndex;

        if (tmp[0] == "\"" && !in_multiline_comment && !in_singleline_comment) {
            tmp2 = lc.match(/(\\)*$/);
            if (!in_string || !tmp2 || (tmp2[0].length % 2) == 0) {	// start of string with ", or unescaped " character found to end string
                in_string = !in_string;
            }
            from--; // include " character in next catch
            rc = json.substring(from);
        }
        else if (tmp[0] == "/*" && !in_string && !in_multiline_comment && !in_singleline_comment) {
            in_multiline_comment = true;
        }
        else if (tmp[0] == "*/" && !in_string && in_multiline_comment && !in_singleline_comment) {
            in_multiline_comment = false;
        }
        else if (tmp[0] == "//" && !in_string && !in_multiline_comment && !in_singleline_comment) {
            in_singleline_comment = true;
        }
        else if ((tmp[0] == "\n" || tmp[0] == "\r") && !in_string && !in_multiline_comment && in_singleline_comment) {
            in_singleline_comment = false;
        }
        else if (!in_multiline_comment && !in_singleline_comment && !(/\n|\r|\s/.test(tmp[0]))) {
            new_str[ns++] = tmp[0];
        }
    }
    new_str[ns++] = rc;
    return new_str.join("");
};

JSON.parse2 = json => JSON.parse(JSON.minify(json));