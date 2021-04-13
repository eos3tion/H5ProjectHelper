const fs = require('fs');
const paths = require('path');

function solveVersionFile(dir_res: string, dict, outputDir: string, version: number) {
    if (dict) {
        var versionTxtName = version + ".txt";
        var outtxt = paths.join(outputDir, versionTxtName);
        var str = "";
        for (var key in dict) {
            let info = dict[key];
            if (info.isDel) {
                continue;
            }
            str += handleResourcePath(info, dir_res);
        }
        fs.writeFile(outtxt, str, function (err) {
            if (err) {
                return console.error(err);
            }
        });
    }
}

function handleResourcePath(info: ResInfo, dir_res: string) {
    let { uri, md5, fullPath } = info;
    if (fs.existsSync(paths.join(dir_res, fullPath))) {
        var extname = paths.extname(uri);
        var md5Name = md5.substring(0, 2);
        let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname))
        var str = uri + "\t" + md5TfName + "\n";
        var str1 = str.replace(/\\/g, "/")
        return str1;
    } else {
        console.log(`未找到` + fullPath);
        return "";
    }
}

// solveVersionFile("E:", dict, "E:/output", 20210402)
