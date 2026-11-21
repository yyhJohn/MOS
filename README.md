# MOS 源代码

基于上线版本 `20261121T164903Z-mixed-item-queue`

这是 MOS 公网版本的源码快照，包含语音控制、按顺序执行开灯和窗帘指令，以及取物与归还混合队列。

演示视频及其封面未收录。网页所用的 Bricolage Grotesque 和 DM Sans 字体授权文件位于 `web/assets/`。

- `web/` 存放网页、Canvas 房间、场景脚本、样式和网页使用的资源。
- `server/server.py` 是 MOS Chat 的 Python 后端。后端使用标准库。
- `deploy/` 包含 Ubuntu 或 Debian 可用的 systemd 单元和 Nginx 示例。

## 本地预览

在 MOS 源码目录运行以下命令，然后访问 `http://127.0.0.1:8000/`。房间和预设场景直接在浏览器运行，交互分镜位于 `/storyboards.html`。连接 MOS Chat 需要下面的后端服务。

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory web
```

## 部署 MOS Chat

在已安装 Python 3、Nginx 和 `htpasswd` 的 Ubuntu 或 Debian 主机上操作。将 Nginx 示例中的 `mos.example.com` 换成自己的域名，并准备对应的 HTTPS 证书。后端会检查请求域名和 HTTPS 来源。使用其他域名时，也要将它加入 `server/server.py` 的 `ALLOWED_HOSTS`。

```bash
sudo install -d -m 0755 /opt/mos-ai /var/www/hci-demo
sudo install -d -m 0700 /etc/mos-ai
sudo install -m 0644 server/server.py /opt/mos-ai/server.py
sudo cp -R web/. /var/www/hci-demo/
sudo install -m 0600 deploy/model.conf.example /etc/mos-ai/model.conf
sudo install -m 0600 /path/to/openai.key /etc/mos-ai/openai.key
sudo install -m 0644 deploy/mos-ai.service /etc/systemd/system/mos-ai.service
```

用本机已有的 API 密钥文件路径替换 `/path/to/openai.key`。示例配置使用部署时的模型名。可以在 `/etc/mos-ai/model.conf` 选择后端支持且账户可用的模型。可选的 Home Assistant 设置也在同一个示例配置里。

建立 MOS 专用的登录账户。将命令中的 `YOUR_USER` 换成所需的用户名，按提示输入密码。

```bash
if ! sudo test -e /etc/nginx/mos-ai.htpasswd; then
  sudo install -o root -g www-data -m 0640 /dev/null /etc/nginx/mos-ai.htpasswd
fi
sudo htpasswd -B /etc/nginx/mos-ai.htpasswd YOUR_USER
```

将 `deploy/nginx/mos-ai-{auth,direct}.conf` 放到 `/etc/nginx/snippets/`，将 `mos-ai-rate.conf` 放到 `/etc/nginx/conf.d/`。修改 `mos-site.conf.example` 的域名和证书路径后，以 `.conf` 扩展名放到 `/etc/nginx/conf.d/`。如果把 MOS 放在现有站点的 `/hci-demo/` 路径，则将 `mos-ai-mirror.conf` 安装到 `/etc/nginx/snippets/`，并在该站点的 `server` 块引入它，同时配置静态目录映射。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mos-ai.service
sudo nginx -t
sudo systemctl reload nginx
sudo journalctl -u mos-ai.service -f
```

打开自己的站点并点击 **Connect AI**，用刚创建的账户登录。
