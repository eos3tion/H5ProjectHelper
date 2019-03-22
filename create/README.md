## 说明
用于在Linux下创建新的H5项目  

## linux下使用白鹭进行编译的方法  
1. 自行安装node环境  
   本人采用 `https://github.com/creationix/nvm#ansible` 项目进行的安装
2. 拉取白鹭项目  
   由于对白鹭命令行脚本增加了`copylib`方法，建议使用本人改版后的白鹭  
   在`/data/egret-core`目录下，拉取我改版后的白鹭项目方法：  
   ```shell
   mkdir -p /data/egret-core
   cd /data/egret-core
   git init
   git remote add 3tion https://github.com/eos3tion/egret-core.git
   git fetch 3tion h5build
   git checkout -b h5build
   ```
3. 将`egret`添加到`PATH`中，让其可执行  
   本人使用`CentOS 7`  
   ```shell
   echo export PATH=\"/root/egret/egret-core/tools/bin:\$PATH\">>~/.bashrc
   ```
   其他版本`Linux`自行添加环境变量  
4. 测试`egret`指令
   ```shell
   egret info
   ```
   如果能正常显示，则表示处理成功
   