import {Int64} from './Int64';

/**
 * 
 * ByteArray 类提供用于优化读取、写入以及处理二进制数据的方法和属性。
 * 注意：ByteArray 类适用于需要在字节层访问数据的高级开发人员。
 * 
 */
export class ByteArray {

    /**
     * @protected
     */
    protected bufferExtSize: number = 256;//Buffer expansion size

    protected data: Buffer;
    /**
     * @protected
     * 当前读写超值的游标
     */
    protected _position: number;
    /**
     * @protected
     * 有效数据的游标
     */
    protected write_position: number;
    /**
     * 
     * 更改或读取数据的字节顺序；egret.Endian.BIG_ENDIAN 或 egret.Endian.LITTLE_ENDIAN。
     * @default egret.Endian.BIG_ENDIAN
     * 
     * 
     */
    public endian: Endian;


    /**
     * Creates an instance of ByteArray
     * 
     * @param {Buffer} [buffer] 原始buffer
     * @param {number} [bufferExtSize] 每次扩展的大小
     */
    constructor(buffer?: Buffer, bufferExtSize?: number) {
        bufferExtSize = bufferExtSize || 256;
        if (bufferExtSize < 0) {
            bufferExtSize = 256;
        }
        this.bufferExtSize = bufferExtSize;
        this._setArrayBuffer(buffer || Buffer.alloc(bufferExtSize));
        this.endian = Endian.BIG_ENDIAN;
    }

    /**
     * @protected
     * @param buffer
     */
    protected _setArrayBuffer(buffer: Buffer): void {
        this.write_position = buffer.length;
        this.data = buffer;
        this._position = 0;
    }

    /**
     * 
     * 获取使用的buffer
     * @readonly
     * @type {Buffer}
     */
    public get usedBuffer(): Buffer {
        return this.data.slice(0, this._position);
    }

    public get buffer(): Buffer {
        return this.data;
    }

    /**
     * @protected
     */
    public set buffer(value: Buffer) {
        this.data = value;
        this.write_position = value.length;
    }

    /**
     * 
     * 将文件指针的当前位置（以字节为单位）移动或返回到 ByteArray 对象中。下一次调用读取方法时将在此位置开始读取，或者下一次调用写入方法时将在此位置开始写入。
     * 
     * 
     */
    public get position(): number {
        return this._position;
    }

    public set position(value: number) {
        //if (this._position < value) {
        //    if (!this.validate(value - this._position)) {
        //        return;
        //    }
        //}
        this._position = value;
        this.write_position = value > this.write_position ? value : this.write_position;
    }
    /**
     * 
     * ByteArray 对象的长度（以字节为单位）。
     * 如果将长度设置为大于当前长度的值，则用零填充字节数组的右侧。
     * 如果将长度设置为小于当前长度的值，将会截断该字节数组。
     * 
     * 
     */
    public get length(): number {
        return this.write_position;
    }

    public set length(value: number) {
        this.write_position = value;
        var tmp: Buffer = Buffer.alloc(value);
        var byteLength: number = this.data.length;
        if (byteLength > value) {
            this._position = value;
        }
        var len: number = Math.min(byteLength, value);
        this.data.copy(tmp, 0, len);
        this.buffer = tmp;
    }

    /**
     * 
     * 可从字节数组的当前位置到数组末尾读取的数据的字节数。
     * 每次访问 ByteArray 对象时，将 bytesAvailable 属性与读取方法结合使用，以确保读取有效的数据。
     * 
     * 
     */
    public get bytesAvailable(): number {
        return this.data.length - this._position;
    }

    /**
     * 
     * 清除字节数组的内容，并将 length 和 position 属性重置为 0。
     * 
     * 
     */
    public clear(): void {
        this.position = 0;
        this.write_position = 0;
    }
    /**
     * 
     * 从字节流中读取布尔值。读取单个字节，如果字节非零，则返回 true，否则返回 false
     * @return 如果字节不为零，则返回 true，否则返回 false
     * 
     * 
     */
    public readBoolean(): boolean {
        if (!this.validate(ByteArraySize.SIZE_OF_BOOLEAN)) return null;

        return this.data.readUInt8(this.position++) != 0;
    }
    /**
     * 
     * 从字节流中读取带符号的字节
     * @return 介于 -128 和 127 之间的整数
     * 
     * 
     */
    public readByte(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_INT8)) return null;

        return this.data.readInt8(this.position++);
    }
    /**
     * 
     * 从字节流中读取 length 参数指定的数据字节数。从 offset 指定的位置开始，将字节读入 bytes 参数指定的 ByteArray 对象中，并将字节写入目标 ByteArray 中
     * @param bytes 要将数据读入的 ByteArray 对象
     * @param offset bytes 中的偏移（位置），应从该位置写入读取的数据
     * @param length 要读取的字节数。默认值 0 导致读取所有可用的数据
     * 
     * 
     */
    public readBytes(bytes: ByteArray, offset: number = 0, length: number = 0): void {
        if (length == 0) {
            length = this.bytesAvailable;
        }
        else if (!this.validate(length)) {
            return null;
        }
        if (bytes) {
            bytes.validateBuffer(offset + length);
        }
        else {
            bytes = new ByteArray(Buffer.alloc(offset + length));
        }
        //This method is expensive
        for (var i = 0; i < length; i++) {
            bytes.data.writeUInt8(i + offset, this.data.readUInt8(this.position++));
        }
    }

    /**
     * 
     * 从字节流中读取一个 IEEE 754 双精度（64 位）浮点数
     * @return 双精度（64 位）浮点数
     * 
     * 
     */
    public readDouble(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_FLOAT64)) return null;

        var value: number = this.endian == Endian.LITTLE_ENDIAN ? this.data.readDoubleLE(this.position) : this.data.readDoubleBE(this.position);
        this.position += ByteArraySize.SIZE_OF_FLOAT64;
        return value;
    }

    /**
     * 
     * 从字节流中读取一个 IEEE 754 单精度（32 位）浮点数
     * @return 单精度（32 位）浮点数
     * 
     * 
     */
    public readFloat(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_FLOAT32)) return null;

        var value: number = this.endian == Endian.LITTLE_ENDIAN ? this.data.readFloatLE(this.position) : this.data.readFloatBE(this.position);
        this.position += ByteArraySize.SIZE_OF_FLOAT32;
        return value;
    }

    /**
     * @language en_US
     * Read a 32-bit signed integer from the byte stream.
     * @return A 32-bit signed integer ranging from -2147483648 to 2147483647
     * 
     * 
     */
    /**
     * 
     * 从字节流中读取一个带符号的 32 位整数
     * @return 介于 -2147483648 和 2147483647 之间的 32 位带符号整数
     * 
     * 
     */
    public readInt(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_INT32)) return null;

        var value = this.endian == Endian.LITTLE_ENDIAN ? this.data.readInt32LE(this.position) : this.data.readInt32BE(this.position);
        this.position += ByteArraySize.SIZE_OF_INT32;
        return value;
    }
    /**
     * 
     * 从字节流中读取一个带符号的 16 位整数
     * @return 介于 -32768 和 32767 之间的 16 位带符号整数
     * 
     * 
     */
    public readShort(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_INT16)) return null;

        var value = this.endian == Endian.LITTLE_ENDIAN ? this.data.readInt16LE(this.position) : this.data.readInt16BE(this.position);
        this.position += ByteArraySize.SIZE_OF_INT16;
        return value;
    }
    /**
     * 
     * 从字节流中读取无符号的字节
     * @return 介于 0 和 255 之间的 32 位无符号整数
     * 
     * 
     */
    public readUnsignedByte(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_UINT8)) return null;

        return this.data.readUInt8(this.position++);
    }

    /**
     * 
     * 从字节流中读取一个无符号的 32 位整数
     * @return 介于 0 和 4294967295 之间的 32 位无符号整数
     * 
     * 
     */
    public readUnsignedInt(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_UINT32)) return null;

        var value = this.endian == Endian.LITTLE_ENDIAN ? this.data.readUInt32LE(this.position) : this.data.readUInt32BE(this.position);
        this.position += ByteArraySize.SIZE_OF_UINT32;
        return value;
    }

    /**
     * 
     * 从字节流中读取一个无符号的 16 位整数
     * @return 介于 0 和 65535 之间的 16 位无符号整数
     * 
     * 
     */
    public readUnsignedShort(): number {
        if (!this.validate(ByteArraySize.SIZE_OF_UINT16)) return null;

        var value = this.endian == Endian.LITTLE_ENDIAN ? this.data.readUInt16LE(this.position) : this.data.readUInt16BE(this.position);
        this.position += ByteArraySize.SIZE_OF_UINT16;
        return value;
    }

    /**
     * 
     * 从字节流中读取一个 UTF-8 字符串。假定字符串的前缀是无符号的短整型（以字节表示长度）
     * @return UTF-8 编码的字符串
     * 
     * 
     */
    public readUTF(): string {
        if (!this.validate(ByteArraySize.SIZE_OF_UINT16)) return null;

        var length: number = this.readUnsignedShort();
        if (length > 0) {
            return this.readUTFBytes(length);
        } else {
            return "";
        }
    }

    /**
     * 
     * 从字节流中读取一个由 length 参数指定的 UTF-8 字节序列，并返回一个字符串
     * @param length 指明 UTF-8 字节长度的无符号短整型数
     * @return 由指定长度的 UTF-8 字节组成的字符串
     * 
     * 
     */
    public readUTFBytes(length: number): string {
        if (!this.validate(length)) return null;
        var start = this.position;
        this.position += length;
        return this.data.toString("utf8", start, this.position);
    }

    /**
     * 
     * 写入布尔值。根据 value 参数写入单个字节。如果为 true，则写入 1，如果为 false，则写入 0
     * @param value 确定写入哪个字节的布尔值。如果该参数为 true，则该方法写入 1；如果该参数为 false，则该方法写入 0
     * 
     * 
     */
    public writeBoolean(value: boolean): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_BOOLEAN);
        this.data.writeUInt8(value ? 1 : 0, this.position++);
    }

    /**
     * 
     * 在字节流中写入一个字节
     * 使用参数的低 8 位。忽略高 24 位
     * @param value 一个 32 位整数。低 8 位将被写入字节流
     * 
     * 
     */
    public writeByte(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_INT8);
        this.data[this.position++] = value;
    }

    /**
     * 
     * 将指定字节数组 bytes（起始偏移量为 offset，从零开始的索引）中包含 length 个字节的字节序列写入字节流
     * 如果省略 length 参数，则使用默认长度 0；该方法将从 offset 开始写入整个缓冲区。如果还省略了 offset 参数，则写入整个缓冲区
     * 如果 offset 或 length 超出范围，它们将被锁定到 bytes 数组的开头和结尾
     * @param bytes ByteArray 对象
     * @param offset 从 0 开始的索引，表示在数组中开始写入的位置
     * @param length 一个无符号整数，表示在缓冲区中的写入范围
     * 
     * 
     */
    public writeBytes(bytes: ByteArray, offset: number = 0, length: number = 0): void {
        var writeLength: number;
        if (offset < 0) {
            return;
        }
        if (length < 0) {
            return;
        }
        else if (length == 0) {
            writeLength = bytes.length - offset;
        }
        else {
            writeLength = Math.min(bytes.length - offset, length);
        }
        if (writeLength > 0) {
            this.validateBuffer(writeLength);
            var start = this.position;
            this.position += writeLength;
            bytes.data.copy(this.data, start, offset, offset + writeLength);
        }
    }

    /**
     * 写入Buffer数据
     * 
     * @param {Buffer} buffer     node的Buffer
     * @param {number} [offset=0] 从 0 开始的索引，表示在数组中开始写入的位置
     * @param {number} [length=0] 一个无符号整数，表示在缓冲区中的写入范围
     * @returns
     */
    public writeBuffer(buffer: Buffer, offset: number = 0, length: number = 0) {
        var writeLength: number;
        if (offset < 0) {
            return;
        }
        if (length < 0) {
            return;
        }
        else if (length == 0) {
            writeLength = buffer.length - offset;
        }
        else {
            writeLength = Math.min(buffer.length - offset, length);
        }
        if (writeLength > 0) {
            this.validateBuffer(writeLength);
            var start = this.position;
            this.position += writeLength;
            buffer.copy(this.data, start, offset, offset + writeLength);
        }
    }

    /**
     * 
     * 在字节流中写入一个 IEEE 754 双精度（64 位）浮点数
     * @param value 双精度（64 位）浮点数
     * 
     * 
     */
    public writeDouble(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_FLOAT64);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeDoubleLE(value, this.position) : this.data.writeDoubleBE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_FLOAT64;
    }

    /**
     * 
     * 在字节流中写入一个 IEEE 754 单精度（32 位）浮点数
     * @param value 单精度（32 位）浮点数
     * 
     * 
     */
    public writeFloat(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_FLOAT32);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeFloatLE(value, this.position) : this.data.writeFloatBE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_FLOAT32;
    }

    /**
     * 
     * 在字节流中写入一个带符号的 32 位整数
     * @param value 要写入字节流的整数
     * 
     * 
     */
    public writeInt(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_INT32);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeInt32LE(value, this.position) : this.data.writeInt32BE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_INT32;
    }

    /**
     * 
     * 在字节流中写入一个 16 位整数。使用参数的低 16 位。忽略高 16 位
     * @param value 32 位整数，该整数的低 16 位将被写入字节流
     * 
     * 
     */
    public writeShort(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_INT16);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeInt16LE(value, this.position) : this.data.writeInt16BE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_INT16;
    }

    /**
     * 
     * 在字节流中写入一个无符号的 32 位整数
     * @param value 要写入字节流的无符号整数
     * 
     * 
     */
    public writeUnsignedInt(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_UINT32);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeUInt32LE(value, this.position) : this.data.writeUInt32BE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_UINT32;
    }

    /**
     * 
     * 在字节流中写入一个无符号的 16 位整数
     * @param value 要写入字节流的无符号整数
     * 
     * 
     */
    public writeUnsignedShort(value: number): void {
        this.validateBuffer(ByteArraySize.SIZE_OF_UINT16);
        this.endian == Endian.LITTLE_ENDIAN ? this.data.writeUInt16LE(value, this.position) : this.data.writeUInt16BE(value, this.position);
        this.position += ByteArraySize.SIZE_OF_UINT16;
    }

    /**
     * 
     * 将 UTF-8 字符串写入字节流。先写入以字节表示的 UTF-8 字符串长度（作为 16 位整数），然后写入表示字符串字符的字节
     * @param value 要写入的字符串值
     * 
     * 
     */
    public writeUTF(value: string): void {
        var length: number = Buffer.byteLength(value);
        this.writeUnsignedShort(length);
        this.validateBuffer(length);
        this.data.write(value, this.position, length);
        this.position += length;
    }
    /**
     * 
     * 将 UTF-8 字符串写入字节流。类似于 writeUTF() 方法，但 writeUTFBytes() 不使用 16 位长度的词为字符串添加前缀
     * @param value 要写入的字符串值
     * 
     * 
     */
    public writeUTFBytes(value: string): void {
        var length: number = Buffer.byteLength(value);
        this.validateBuffer(length);
        this.data.write(value, this.position, length);
        this.position += length;
    }

    /**
     *
     * @returns
     * 
     * 
     */
    public toString(): string {
        return "[ByteArray] length:" + this.length + ", bytesAvailable:" + this.bytesAvailable;
    }



    /**
     * @param len
     * @returns
     * 
     * 
     * @protected
     */
    public validate(len: number): boolean {
        //len += this.data.byteOffset;
        if (this.data.length > 0 && this._position + len <= this.data.length) {
            return true;
        } else {
            console.error(`数据的长度不足，数据长度：${this.data.length}，当前索引：${this._position}，要读取的长度：${len}`);
        }
    }


    /**
     * @protected
     * @param len
     * @param needReplace
     */
    protected validateBuffer(len: number, needReplace: boolean = false): void {
        this.write_position = len > this.write_position ? len : this.write_position;
        len += this._position;
        if (this.data.length < len || needReplace) {
            var tmp: Buffer = Buffer.alloc(len + this.bufferExtSize);
            var length = Math.min(this.data.length, len + this.bufferExtSize);
            this.data.copy(tmp, 0, 0, length);
            this.buffer = tmp;
        }
    }


    /**********************/
    /*  用于处理ProtoBuf   */
    /**********************/
    /**
     * 向字节流中写入64位的可变长度的整数(Protobuf)
     */
    public writeVarint64(value: number): void {
        let i64 = Int64.fromNumber(value);
        var high = i64.high;
        var low = i64.low;
        if (high == 0) {
            this.writeVarint(low)
        } else {
            for (var i = 0; i < 4; ++i) {
                this.writeByte((low & 0x7F) | 0x80)
                low >>>= 7
            }
            if ((high & (0xFFFFFFF << 3)) == 0) {
                this.writeByte((high << 4) | low)
            }
            else {
                this.writeByte((((high << 4) | low) & 0x7F) | 0x80)
                this.writeVarint(high >>> 3)
            }
        }
    }

    /**
     * 向字节流中写入32位的可变长度的整数(Protobuf)
     */
    public writeVarint(value: number): void {
        for (; ;) {
            if (value < 0x80) {
                this.writeByte(value)
                return;
            }
            else {
                this.writeByte((value & 0x7F) | 0x80)
                value >>>= 7
            }
        }
    }

    /**
     * 读取字节流中的32位变长整数(Protobuf)
     */
    public readVarint(): number {
        var result: number = 0
        for (var i: number = 0; ; i += 7) {
            var b: number = this.readUnsignedByte()
            if (i < 32) {
                if (b >= 0x80) {
                    result |= ((b & 0x7f) << i)
                }
                else {
                    result |= (b << i)
                    break
                }
            }
            else {
                while (this.readUnsignedByte() >= 0x80) {
                }
                break
            }
        }
        return result
    }

    /**
     * 读取字节流中的32位变长整数(Protobuf)
     */
    public readVarint64() {
        var result = new Int64();
        var b: number
        var i: number = 0
        for (; ; i += 7) {
            b = this.readUnsignedByte()
            if (i == 28) {
                break
            }
            else {
                if (b >= 0x80) {
                    result.low |= ((b & 0x7f) << i)
                }
                else {
                    result.low |= (b << i)
                    return result
                }
            }
        }
        if (b >= 0x80) {
            b &= 0x7f
            result.low |= (b << i)
            result.high = b >>> 4
        }
        else {
            result.low |= (b << i)
            result.high = b >>> 4
            return result
        }
        for (i = 3; ; i += 7) {
            b = this.readUnsignedByte()
            if (i < 32) {
                if (b >= 0x80) {
                    result.high |= ((b & 0x7f) << i)
                }
                else {
                    result.high |= (b << i)
                    break
                }
            }
        }
        return result
    }

    /**
     * 
     * 读取指定长度的ByteArray
     * @param {number} length       指定的长度
     * @returns {ByteArray}
     */
    public readByteArray(length: number): ByteArray {
        return new ByteArray(this.buffer.slice(this._position, this._position + length));
    }

    public readFix32() {
        if (this.validate(ByteArraySize.SIZE_OF_FIX32)) {
            let value = this.data.readUInt32LE(this._position);
            this.position += ByteArraySize.SIZE_OF_UINT32;
            return value;
        }
    }

    public writeFix32(value: number) {
        this.validateBuffer(ByteArraySize.SIZE_OF_FIX32);
        this.data.writeUInt32LE(value, this._position);
        this.position += ByteArraySize.SIZE_OF_FIX32;
    }

    public readSFix32() {
        if (this.validate(ByteArraySize.SIZE_OF_SFIX32)) {
            let value = this.data.readInt32LE(this._position);
            this.position += ByteArraySize.SIZE_OF_SFIX32;
            return value;
        }
    }

    public writeSFix32(value: number) {
        this.validateBuffer(ByteArraySize.SIZE_OF_SFIX32);
        this.data.writeInt32LE(value, this._position);
        this.position += ByteArraySize.SIZE_OF_SFIX32;
    }

    public readFix64() {
        if (this.validate(ByteArraySize.SIZE_OF_FIX64)) {
            let pos = this._position;
            let data = this.data;
            let low = data.readUInt32LE(pos);
            let high = data.readUInt32LE(pos + ByteArraySize.SIZE_OF_UINT32);
            this.position = pos + ByteArraySize.SIZE_OF_FIX64;
            return Int64.toNumber(low, high);
        }
    }

    public writeFix64(value: number) {
        let i64 = Int64.fromNumber(value);
        this.validateBuffer(ByteArraySize.SIZE_OF_FIX64);
        let pos = this._position;
        let data = this.data;
        data.writeInt32LE(i64.low, pos);
        data.writeInt32LE(i64.high, pos + ByteArraySize.SIZE_OF_UINT32);
        this.position = pos + ByteArraySize.SIZE_OF_FIX64;
    }

    /**
    * 读取ProtoBuf的`Double`
    * protobuf封装是使用littleEndian的，不受Endian影响
    */
    public readPBDouble() {
        if (this.validate(ByteArraySize.SIZE_OF_DOUBLE)) {
            let value = this.data.readDoubleLE(this._position);
            this.position += ByteArraySize.SIZE_OF_DOUBLE;
            return value;
        }
    }

    /**
     * 写入ProtoBuf的`Double`
     * protobuf封装是使用littleEndian的，不受Endian影响
     * @param value 
     */
    public writePBDouble(value: number) {
        this.validateBuffer(ByteArraySize.SIZE_OF_DOUBLE);
        this.data.writeDoubleLE(value, this._position);
        this.position += ByteArraySize.SIZE_OF_DOUBLE;
    }

    /**
     * 读取ProtoBuf的`Float`
     * protobuf封装是使用littleEndian的，不受Endian影响
     */
    public readPBFloat() {
        if (this.validate(ByteArraySize.SIZE_OF_FLOAT)) {
            let value = this.data.readFloatLE(this._position);
            this.position += ByteArraySize.SIZE_OF_FLOAT;
            return value;
        }
    }

    /**
      * 写入ProtoBuf的`Float`
      * protobuf封装是使用littleEndian的，不受Endian影响
      * @param value 
      */
    public writePBFloat(value: number) {
        this.validateBuffer(ByteArraySize.SIZE_OF_FLOAT);
        this.data.writeFloatLE(value, this._position);
        this.position += ByteArraySize.SIZE_OF_FLOAT;
    }



    /**********************/
    /*  用于处理流式的操作 */
    /**********************/

    private _mark: number;

    /**
     * 清理掉position前的数据，同时将position设置为0，
     * 当使用ByteArray处理流数据时，从ByteArray读取了大量数据以后，可调用来减少内存占用
     */
    public flip() {
        let p = this._position;
        this.data = this.data.slice(p);
        this.write_position -= p;
    }

    /**
     * 标记position的位置，用于rewind操作时，可用进行回滚
     */
    public mark() {
        this._mark = this._position;
    }

    /**
     * 将position回滚至mark处
     */
    public reset() {
        if (this._mark < this._position) {
            this._position = this._mark;
        }
    }

    /**
     * 把position设为0，limit不变，一般在把数据重写入Buffer前调用。
     */
    public rewind() {
        this._position = 0;
    }
}