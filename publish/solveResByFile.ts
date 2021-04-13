const fs = require('fs');
const paths = require('path');
const crypto = require('crypto');
async function fileDisplay(filePath: string, output: string, version: number) {
    var arr = [];
    let willChecked = [filePath];
    while (willChecked.length) {
        let chk = willChecked.pop();
        if (!fs.existsSync(chk)) {
            continue;
        }
        let stat = fs.statSync(chk);
        if (stat.isDirectory()) {
            let files = fs.readdirSync(chk);
            files.forEach(file => {
                willChecked.push(paths.join(chk, file));
            });
        }
        else {
            arr.push(chk);
        }
    }
    await checkFiles(arr, output, version, filePath);
}

async function checkFiles(arr: string[], outputDir: string, version: number, filePath: string) {
    var versionTxtName = version + ".txt";
    var outtxt = paths.join(outputDir, versionTxtName);
    var outStr: { str?} = {};
    outStr.str = '';
    for (var i = 0; i < arr.length; i++) {
        let filedir = arr[i];
        await sloveFile(filedir, outputDir, outStr, filePath);
    }
    fs.writeFile(outtxt, outStr.str, function (err) {
        if (err) {
            return console.error(err);
        }
        console.log(`写入完成！`)
    });
}

function sloveFile(filedir: string, output: string, outStr: string, filePath: string) {
    var fullPath = filedir.slice(2);
    let stream = fs.createReadStream(filedir);
    let md5util = crypto.createHash('md5');
    let md5;//getMD5(buffer);        
    try {
        stream.read();
    } catch (e) {
        console.log(`${fullPath}流读取失败，${e.message}`);
        return;
    }
    return new Promise((resolve, _) => {
        stream.on("end", () => {
            md5 = md5util.digest("hex");
            if (fs.existsSync(filedir)) {
                outStr.str += doFileHandle(filedir, md5, output, filePath)
            }
            resolve();
        })
        stream.on("data", (data) => {
            md5util.update(data);
        });
        stream.on("error", err => {
            console.log(filedir, "发生错误", err.message)
            md5util.end();
            resolve();//还是当resolve处理
        })
    });
}

function doFileHandle(filedir: string, md5: string, filePath: string) {
    if (fs.existsSync(filedir)) {
        var extname = paths.extname(filedir);
        var md5Name = md5.substring(0, 2);
        let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname))
        var cStr = filedir.replace(/\\/g, "/");
        var str = cStr.replace(filePath, "") + "\t" + md5TfName + "\n";
        var str1 = str.replace(/\\/g, "/")
        return str1;
    }
}

// fileDisplay("E:/data/projects/huaqiangu/www/res/cn/", "E:/output1/", 20210406)