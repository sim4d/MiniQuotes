# Mini Quotes
名人名言微信小程序

这是2025新版，希望借助 TRAE 等编程工具，提供更多的功能。

旧版仍然保留在 [sim4d/mini-quotes.git](../../../mini-quotes) 项目中。

## 开发环境
- 准备 sandbox (要求 pub key 已经在 GitHub 账户 Profile 设置好)

```bash
cd ~/
mkdir sandbox
cd sandbox
git clone git@github.com:sim4d/MiniQuotes.git MiniQuotes
```

- 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 从上述目录导入项目

## 最新版本
- [releases](../../releases) 

## 扫描试用
微信扫码

![Mini Quotes](./MiniQuotes.jpg)

## License: MIT
本项目采用 MIT 许可证授权。

## SSH连接方面
​​测试HTTPS端口​​：有时防火墙会完全拒绝允许SSH连接，此时可以尝试使用通过HTTPS端口创建的SSH连接克隆。运行以下命令：

```bash
ssh -T -p 443 git@ssh.github.com
```

若显示“# Hi {USERNAME}! You've successfully authenticated, but GitHub does not # provide shell access.”，则证明可以通过HTTPS连接。

### ​​启用通过HTTPS的SSH连接​​：
若上述方法可行，可覆盖SSH设置来强制与GitHub.com的任何连接均通过该服务器和端口运行。打开SSH的config文档（通常位于“~/.ssh/config”），添加以下字段：

```bash
Host github.com
    Hostname ssh.github.com
    Port 443
    User git
```

