const fs = require('fs');
const paths = require('path');
const crypto = require('crypto');
async function doFileHandle(filedir: string, outputDir: string, key: string, value: string) {
    var rawDir = paths.join(filedir, key);
    if (fs.existsSync(rawDir)) {
        var fliename = paths.join(outputDir, value.substring(0, 2));
        let dirPath = paths.join(outputDir, value);
        if (!fs.existsSync(fliename)) {
            fs.mkdir(fliename, { recursive: true }, (err) => {
                if (err) {
                    throw err;
                } else {
                    if (!fs.existsSync(dirPath)) {
                        fs.copyFileSync(rawDir, dirPath);
                        console.log("拷贝" + rawDir + "成功！");
                    }
                }
            });
        } else {
            if (!fs.existsSync(dirPath)) {
                fs.copyFileSync(rawDir, dirPath);
                console.log("拷贝" + rawDir + "成功！");
            }
        }
    }
}

function sloveTXT(fullPath: string, filedir: string, outputDir: string) {
    if (fs.existsSync(fullPath)) {
        fs.readFile(fullPath, 'utf-8', async function (err, data) {
            if (err) {
                console.error(err);
            } else {
                // console.log(data);
                var arr = data.split("\n");
                if (arr && arr.length) {
                    while (arr.length) {
                        let sinStr = arr.pop();
                        if (sinStr) {
                            let sinArr = sinStr.split("\t");
                            if (sinArr && sinArr.length) {
                                let key = sinArr[0];
                                let value = sinArr[1];
                                if (key && value) {
                                    await doFileHandle(filedir, outputDir, key, value)
                                }
                            }
                        }
                    }
                }
            }
        })
    }
}
// sloveTXT("E:/output1/20210406.txt", "E:/data/projects/huaqiangu/www/res/cn/", "E:/output1")