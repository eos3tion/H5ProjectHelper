declare const enum MessageType {
    /**
     * 普通消息
     */
    Message = "msg",
    /**
     * 子任务执行完成
     */
    Done = "done",

    /**
     * 子任务发生错误
     */
    Error = "error",

    /**
     * 子任务请求显示对话框
     */
    DialogShow = "dialog_show",
    /**
     * 子任务请求隐藏对话框
     */
    DialogHide = "dialog_hide",
}

interface Message {
    /**
     * 子任务消息类型
     */
    type: MessageType;
    /**
     * 数据
     */
    data?: any;
}

/**
 * WebSocket状态
 */
declare const enum WebSocketState {
    /**
     * 	The connection is not yet open.
     */
    CONNECTING = 0,
    /**
     * The connection is open and ready to communicate.
     */
    OPEN = 1,
    /**
     * The connection is in the process of closing.
     */
    CLOSING = 2,
    /**
     * The connection is closed or couldn't be opened.
     */
    CLOSED = 3
}