import { ByteArray } from './ByteArray';


interface ArrayLike<T> {
    [index: number]: T;
}

/**
 *  类定义
 */
class ClassDefine {
    public className: string;
    public members: string[];
    public isExternalizable: boolean;
    public isDynamic: boolean;
    constructor(className?: string, members?: any[]) {
        this.className = className || null;
        this.members = members || [];
    }
}
/**
 * 用于WriteObject时，传递的引用表
 * 
 * @class RefTables
 */
class RefTables {
    /**
     * 对象表
     */
    public objTable = [];
    /**
     * 字符串表
     */
    public strTable = [];

    public traitsTable: ClassDefine[] = [];
}

/**
 * AMF3Bytes
 */
export class AMF3Bytes extends ByteArray {

    constructor(buffer?: Buffer) {
        super(buffer)
        this.endian = Endian.BIG_ENDIAN;
    }

    //用于存放注册进来解析Externalizable的
    private static extDic: { [index: string]: { new(), readBytes(ba: AMF3Bytes) } } = {};

    /**
     * 注册解析IExternalizable的类型的处理器
     * @param {string} className
     * @param {class}  clazz
     */
    public static regExternalizable(className: string, clazz: { new(), readBytes(ba: AMF3Bytes) }) {
        AMF3Bytes.extDic[className] = clazz;
    }

    /**********************/
    /*  用于处理AMF对象    */
    /**********************/
    /**
     * 将对象以 AMF 序列化格式写入字节数组。 
     * @param {object} value
     **/
    public writeObject(value: any, refTables?: RefTables) {
        if (undefined === value) {
            return this.encAMF3Head(AMF3_TYPE.UNDEFINED);
        }
        if (null === value) {
            return this.encAMF3Head(AMF3_TYPE.NULL);
        }
        if (false === value) {
            return this.encAMF3Head(AMF3_TYPE.FALSE);
        }
        if (true === value) {
            return this.encAMF3Head(AMF3_TYPE.TRUE);
        }

        var type = typeof value;

        if ('number' === type) {
            if ((value >> 0) === value && value >= -0x10000000 && value < 0x10000000) { //整型
                value &= 0x1fffffff;
                return this.encInteger(value);
            }
            else {
                return this.encDouble(value);
            }
        }

        //用于保存对象引用
        if (!refTables) refTables = new RefTables();

        if ('string' === type) {
            return this.encString(value, refTables, true);
        }

        if (value instanceof Buffer) {
            return this.encBuffer(value);
        }

        if (value instanceof Date) {
            return this.encDate(value, refTables);
        }

        if (value instanceof Array) {
            return this.encArray(value, refTables);
        }

        if (value instanceof Int32Array) {
            return this.encInt32Array(value, refTables);
        }

        if (value instanceof Uint32Array) {
            return this.encUint32Array(value, refTables);
        }

        if (value instanceof Float64Array) {
            return this.encFloat64Array(value, refTables);
        }

        if (value instanceof Map) {
            return this.encMap(value, refTables, false);
        }

        // if (value instanceof WeakMap) {
        //     return this.encMap(value, refTables, true);
        // }

        return this.encObject(value, refTables);
    };

    /**
     * 编码AMF3头
     * @param {number} head AMF3_TYPE的定义的常量
     * 只用写头，不用写数据的：
     * 
     * 0x00 undefined
     * 
     * 0x01 null
     * 
     * 0x02 false
     * 
     * 0x03 true
     **/
    public encAMF3Head(head: number) {
        this.validateBuffer(ByteArraySize.SIZE_OF_UINT8);
        this.data.writeUInt8(head, this.position++);
    }

    /**
     * 编码AMF3整型
     * 
     * 头:0x04
     * @param {number} value
     * 
     **/
    private encInteger(value) {
        this.encAMF3Head(AMF3_TYPE.INTEGER);
        this.writeU29(value);
    }

    /**
     * 编码AMF3双精度浮点型
     * 
     * 头:0x05
     * @param {number} value
     * 
     **/
    private encDouble(value: number) {
        this.encAMF3Head(AMF3_TYPE.DOUBLE);
        this.writeDouble(value);
    }

    /**
     * 编码AMF3字符串
     * 
     * 为了简单起见，字符串不做inline处理，不存入字符串表
     * 
     * 头:0x06
     * @param {string} value
     * @param {$RefTables} refTables
     * @param {boolean} makeHeader 是否写 AMF3_TYPE.STRING
     **/
    private encString(value: string, refTables: RefTables, makeHeader?: boolean) {
        if (makeHeader) {
            this.encAMF3Head(AMF3_TYPE.STRING);
        }
        //获取utf8字符串长度
        var strTable = refTables.strTable;
        if (value) {
            //获取utf8字符串长度
            var strTable = refTables.strTable;
            var idx = strTable.indexOf(value);
            if (idx !== -1) {
                this.writeU29(idx << 1);
                return;
            }
            strTable.push(value);
        }
        var length = Buffer.byteLength(value);
        var flag = length << 1 | 1;
        //将长度用U29写入buffer流
        this.writeU29(flag);
        //检查字符串长度
        this.validateBuffer(length);
        this.data.write(value, this.position, length);
        this.position += length;
    }

    /**
     * 编码AMF3 Date
     * 
     * 0x8
     * @param {Date} value
     * @param {$RefTables} refTables
     **/
    private encDate(value: Date, refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.DATE);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        this.writeU29(1);
        this.writeDouble(value.valueOf());
    }

    /**
     * 编码AMF3数组
     * 
     * 0x9
     * @param {Array} value
     * @param {$RefTables} refTables
     **/
    private encArray(value: any[], refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.ARRAY);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        var len = value.length;
        var flag = (len << 1) | 1;
        this.writeU29(flag);
        for (var key in value) {
            if (key != <any>parseInt(key)) {
                if (typeof value[key] !== 'function') {//不将方法序列号进数据中
                    this.encString(key, refTables);
                    this.writeObject(value[key], refTables);
                }
            }
        }
        //动态属性用空字符串结束
        this.encString("", refTables);
        for (var i = 0; i < len; i++) {
            this.writeObject(value[i], refTables);
        }
    }

    /**
     * 编码AMF3 对象
     * 
     * 0xA
     * @param {Object} value
     * @param {$RefTables} refTables
     **/
    private encObject(value: Object, refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.OBJECT);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        // flag with instance, no traits, no externalizable
        this.writeU29(11);
        // 
        this.encString("", refTables);
        for (var key in value) {
            if (typeof value[key] !== 'function') {//不将方法序列号进数据中
                this.encString(key, refTables);
                this.writeObject(value[key], refTables);
            }
        }
        //动态属性用空字符串结束
        this.encString("", refTables);
    }

    /**
     * 编码Int32Array成AMF3整型的的Vector
     * 
     * 0xD
     * 
     * @param {Int32Array} value
     * @param {$RefTables} refTables
     * 
     **/
    private encInt32Array(value: Int32Array, refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.VECTOR_INT);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        var len = value.length;
        var flag = (len << 1) | 1;
        this.writeU29(flag);
        for (var i = 0; i < len; i++) {
            this.writeInt(value[i]);
        }
    }

    /**
     * 编码Uint32Array成AMF3无符号整型的的Vector
     * 
     * 0xE
     * 
     * @param {Uint32Array} value
     * @param {$RefTables} refTables
     * 
     **/
    private encUint32Array(value: Uint32Array, refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.VECTOR_UINT);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        var len = value.length;
        var flag = (len << 1) | 1;
        this.writeU29(flag);
        for (var i = 0; i < len; i++) {
            this.writeUnsignedInt(value[i]);
        }
    }

    /**
     * 编码Float64Array成AMF3双进度浮点型的Vector
     * 
     * 0xF
     * 
     * @param {Float64Array} value
     * @param {$RefTables} refTables
     * 
     **/
    private encFloat64Array(value: Float64Array, refTables: RefTables) {
        this.encAMF3Head(AMF3_TYPE.VECTOR_DOUBLE);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        var len = value.length;
        var flag = (len << 1) | 1;
        this.writeU29(flag);
        for (var i = 0; i < len; i++) {
            this.writeDouble(value[i]);
        }
    }


    /**
     * 编码Map，转换成AS3的Dictionary
     * 
     * 0x11
     * 
     * @param {Map}             value
     * @param {$RefTables}      refTables
     * @param {boolean}         weakRefrence    是否为弱引用
     **/
    private encMap(value: Map<any, any>, refTables: RefTables, weakRefrence) {
        this.encAMF3Head(AMF3_TYPE.DICTONARY);
        var refTable = refTables.objTable;
        var idx = refTable.indexOf(value);
        if (idx !== -1) {
            this.writeU29(idx << 1);
            return;
        }
        refTable.push(value);
        var len = value["size"];
        var flag = (len << 1) | 1;
        this.writeU29(flag);
        this.writeByte(weakRefrence ? 1 : 0);
        value.forEach
        for (let en of value) {
            this.writeObject(en[0], refTables);
            this.writeObject(en[1], refTables);
        }
    }

    //不处理XML,js没as3的xml对象，另外我们项目也没用xml对象需要进行序列号

    /**
     * 编码字节数组
     * 
     * 头:0x0C
     * @param {Buffer} value
     * 
     **/
    private encBuffer(value: Buffer) {
        if (!Buffer.isBuffer(value)) {
            throw new TypeError("buffer must be Buffer");
        }
        this.encAMF3Head(AMF3_TYPE.BYTEARRAY);
        this.writeBuffer(value);
    }



    /**
     * 写入U29整型
     * @param {number} value
     **/
    private writeU29(value: number) {
        if (typeof value !== "number") {
            throw new TypeError("Value must be Number");
        }
        var len = 0;
        if (value < 0x80) len = 1;
        else if (value < 0x4000) len = 2;
        else if (value < 0x200000) len = 3;
        else if (value < 0x40000000) len = 4;
        else throw new Error("U29 Range Error");// 0x40000000 - 0xFFFFFFFF : throw range exception
        this.validateBuffer(len);
        let _buffer = this.data;
        switch (len) {
            case 1:// 0x00000000 - 0x0000007F : 0xxxxxxx
                _buffer.writeUInt8(value, this._position);
                break;
            case 2:// 0x00000080 - 0x00003FFF : 1xxxxxxx 0xxxxxxx
                _buffer.writeUInt8(((value >> 7) & 0x7F) | 0x80, this._position);
                _buffer.writeUInt8(value & 0x7F, this._position + 1);
                break;
            case 3:// 0x00004000 - 0x001FFFFF : 1xxxxxxx 1xxxxxxx 0xxxxxxx
                _buffer.writeUInt8(((value >> 14) & 0x7F) | 0x80, this._position);
                _buffer.writeUInt8(((value >> 7) & 0x7F) | 0x80, this._position + 1);
                _buffer.writeUInt8(value & 0x7F, this._position + 2);
                break;
            case 4:// 0x00200000 - 0x3FFFFFFF : 1xxxxxxx 1xxxxxxx 1xxxxxxx xxxxxxxx
                _buffer.writeUInt8(((value >> 22) & 0x7F) | 0x80, this._position);
                _buffer.writeUInt8(((value >> 15) & 0x7F) | 0x80, this._position + 1);
                _buffer.writeUInt8(((value >> 8) & 0x7F) | 0x80, this._position + 2);
                _buffer.writeUInt8(value & 0xFF, this._position + 3);
                break;
        }
        this.position += len;
    }

    /**
     * 读取对象
     */
    public readObject(refTables?: RefTables) {
        if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;
        var type = this.data.readUInt8(this._position++);
        if (!refTables) refTables = new RefTables();
        switch (type) {
            case AMF3_TYPE.UNDEFINED:
                return undefined;
            case AMF3_TYPE.NULL:
                return null;
            case AMF3_TYPE.FALSE:
                return false;
            case AMF3_TYPE.TRUE:
                return true;
            case AMF3_TYPE.INTEGER:
                return this.readU29();
            case AMF3_TYPE.DOUBLE:
                return this.readDouble();
            case AMF3_TYPE.STRING:
                return this.readStringAMF3(refTables);
            default:
                if (type <= AMF3_TYPE.DICTONARY) {
                    return this.readRefObject(type, refTables);
                } else {
                    throw Error(`未实现的AMF类型：${type}`);
                }
        }
    }

    private readRefObject(type: number, refTable: RefTables) {
        var object;
        var handle = this.readU29();
        var isIn = (handle & 1) == 0;
        handle = handle >> 1;
        if (isIn) {
            object = refTable.objTable[handle];
        }
        else {
            switch (type) {
                case AMF3_TYPE.ARRAY:
                    object = this.readArray(handle, refTable);
                    break;
                case AMF3_TYPE.OBJECT:
                    object = this.readObj(handle, refTable);
                    break;
                case AMF3_TYPE.DATE:
                    object = this.readDate(refTable);
                    break;
                case AMF3_TYPE.XML:
                case AMF3_TYPE.XMLDOC:
                    object = this.readXML(handle, refTable);
                    break;
                case AMF3_TYPE.BYTEARRAY:
                    object = this._readByteArray(handle, refTable);
                    break;
                case AMF3_TYPE.VECTOR_OBJECT:
                    object = this.readObjectVector(handle, refTable);
                    break;
                case AMF3_TYPE.VECTOR_INT:
                    object = this.readVector(handle, refTable, Int32Array);
                    break;
                case AMF3_TYPE.VECTOR_DOUBLE:
                    object = this.readVector(handle, refTable, Float64Array);
                    break;
                case AMF3_TYPE.VECTOR_UINT:
                    object = this.readVector(handle, refTable, Uint32Array);
                    break;
                case AMF3_TYPE.DICTONARY:
                    object = this.readDictionary(handle, refTable);
                    break;
            }
        }
        return object;
    }

    /**
     * 读取U29数据
     * @return {number} u29数据
     **/
    private readU29() {
        if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;
        var value = this.data.readUInt8(this._position++);

        if (value < 0x80) {//U29 1bytes 0x00-0x7f
            return value;
        }
        if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;
        var tmp = this.data.readUInt8(this._position++);
        value = (value & 0x7f) << 7;
        if (tmp < 0x80) {//U29 2bytes 0x80-0xFF 0x00-0x7f
            value = value | tmp;
        }
        else {
            value = (value | tmp & 0x7f) << 7;
            if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;
            tmp = this.data.readUInt8(this._position++);
            if (tmp < 0x80) { //U29 3bytes 0x80-0xFF 0x80-0xFF 0x00-0x7f
                value = value | tmp;
            }
            else {//u29 4bytes 0x80-0xFF 0x80-0xFF 0x80-0xFF 0x00-0xFF
                value = (value | tmp & 0x7f) << 8;
                if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;
                tmp = this.data.readUInt8(this._position++);
                value = value | tmp;
            }
        }
        return -(value & 0x10000000) | value;
    }

    /**
     * 从AMF3字节中读取字符串
     * 
     * @private
     * @param {RefTables} refTable 引用表
     */
    private readStringAMF3(refTable: RefTables) {
        var handle = this.readU29();
        var inline = (handle & 1) != 0;
        handle = handle >> 1;
        if (inline) {
            if (0 == handle) {
                return "";
            }
            this.validate(handle);
            var start = this.position;
            this.position += handle;
            var str = this.data.toString("utf8", start, this.position);
            refTable.strTable.push(str);
            return str;
        }
        return refTable.strTable[handle];
    }


    /**
     * 读取数组
     * @param length 字节长度
     * @param {RefTables} refTable 引用表
     */
    private readArray(length: number, refTable: RefTables) {
        var instance = [];
        refTable.objTable.push(instance);
        var key;
        while (key = this.readStringAMF3(refTable)) {
            instance[key] = this.readObject(refTable);
        }
        var idx = -1;
        while (++idx < length) {
            instance[idx] = this.readObject(refTable);
        }
        return instance;
    }

    /**
     * 读取对象
     * @param handle 处理标识
     * @param {RefTables} refTable 引用表
     */
    private readObj(handle: number, refTable: RefTables) {
        var traits: string[], classDef: ClassDefine, className, len, i, isExternalizable, isDynamic, instance;
        var inlineClassDef = (handle & 1) == 0;
        handle >>= 1;
        if (inlineClassDef) {
            classDef = refTable.traitsTable[handle];
            if (!classDef) {
                throw new Error("no trait found with refId:" + handle);
            }
            traits = classDef.members;
            className = classDef.className;
            isExternalizable = classDef.isExternalizable;
            isDynamic = classDef.isDynamic;
        }
        else {
            className = this.readStringAMF3(refTable);
            isExternalizable = (handle & 1) != 0;
            handle >>= 1;
            isDynamic = (handle & 1) != 0;
            len = handle >> 1;
            traits = new Array(len);
            for (i = 0; i < len; i++) {
                traits[i] = this.readStringAMF3(refTable);
            }
            classDef = new ClassDefine(className, traits);
            classDef.isExternalizable = isExternalizable;
            classDef.isDynamic = isDynamic;
            refTable.traitsTable.push(classDef);
        }
        if (isExternalizable) {
            var ref = AMF3Bytes.extDic[className];
            if (ref) {
                instance = new ref();
                instance.readBytes(this);
            }
            else {
                throw new Error("Not Implemented IExternalizable Object,className:\n[" + className + "]");
            }
        }
        else {
            instance = {};
        }
        instance[Symbol.for("classDefine")] = classDef;
        refTable.objTable.push(instance);
        var traitsLen = traits.length;
        for (i = 0; i < traitsLen; i++) {
            var key = traits[i];
            instance[key] = this.readObject(refTable);
        }
        if (isDynamic) {
            while (key = this.readStringAMF3(refTable)) {
                instance[key] = this.readObject(refTable);
            }
        }
        return instance;
    }

    /**
     * 读取日期
     * @param {RefTables} refTable 引用表
     */
    private readDate(refTable: RefTables) {
        var date = new Date(this.readDouble());
        refTable.objTable.push(date);
        return date;
    }

    /**
     * 读取XML和XMLDoc，暂时全部当字符串处理
     * @param length 处理的字节长度
     * @param {RefTables} refTable 引用表
     * @returns {string} XML字符串
     */
    private readXML(length: number, refTable: RefTables) {
        this.validate(length);
        var start = this.position;
        this.position += length;
        var xmlString = this.data.toString("utf8", start, this.position);
        refTable.objTable.push(xmlString);
        //暂时按字符串处理
        return xmlString;
    }

    /**
     * 读取字节数组
     * @param length 处理的字节长度
     * @param {RefTables} refTable 引用表
     * @returns {Buffer}
     */
    private _readByteArray(length: number, refTable: RefTables) {
        this.validate(length);
        var start = this.position;
        this.position += length;
        var buf = this.data.slice(start, this.position);
        refTable.objTable.push(buf);
        return buf;
    }

    /**
     * 读取对象的Vector数组
     * @param {number} length 数组长度
     * @param {RefTables} refTable 引用表
     * @returns {Array}
     */
    private readObjectVector(length: number, refTable: RefTables) {
        //fixed
        this.readU29();
        //读取className，as3反射会占用
        this.readStringAMF3(refTable);
        var list = [];
        refTable.objTable.push(list);
        var idx = -1;
        while (++idx < length) {
            list[idx] = this.readObject(refTable);
        }
        return list;
    }

    /**
     * 读取数值类型的Vector数组
     * @param {number} length 数组长度
     * @param {RefTables} refTable 引用表
     * @param ref   Vector的实现类型
     * @returns ref指定的类型
     */
    private readVector(length: number, refTable: RefTables, ref: { new(length: number): ArrayLike<any> }) {
        //fixed
        this.readU29();
        var list = new ref(length);
        refTable.objTable.push(list);
        var idx = -1;
        while (++idx < length) {
            list[idx] = this.readObject(refTable);
        }
        return list;
    }

    /**
     * 读取字典
     * @param {number} length 数组长度
     * @param {RefTables} refTable 引用表
     * @returns {Map}存储Dictionary() {WeakMap}存储Dictionary(true)
     */
    private readDictionary(length: number, refTable: RefTables) {
        var weakKeys = !this.readBoolean();
        var dic;
        if (weakKeys) {
            dic = new WeakMap();
        }
        else {
            dic = new Map();
        }
        refTable.objTable.push(dic);
        for (var i = 0; i < length; i++) {
            var key = this.readObject(refTable);
            var value = this.readObject(refTable);
            dic.set(key, value);
        }
        return dic;
    }

}