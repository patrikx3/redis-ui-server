# This is a development package

For the full-blown package, please follow:     
https://github.com/patrikx3/redis-ui  
https://www.npmjs.com/package/p3x-redis-ui   
https://corifeus.com/redis-ui   

[//]: #@corifeus-header

 [![NPM](https://img.shields.io/npm/v/p3x-redis-ui-server.svg)](https://www.npmjs.com/package/p3x-redis-ui-server)  [![Donate for PatrikX3 / P3X](https://img.shields.io/badge/Donate-PatrikX3-003087.svg)](https://paypal.me/patrikx3) [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Corifeus @ Facebook](https://img.shields.io/badge/Facebook-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)  [![Uptime ratio (90 days)](https://network.corifeus.com/public/api/uptime-shield/31ad7a5c194347c33e5445dbaf8.svg)](https://network.corifeus.com/status/31ad7a5c194347c33e5445dbaf8)



---
# 🏍️ P3X Redis UI server — Socket.IO backend for the dual Angular + React frontend with AI queries, 54 languages, and auto data decompression v2026.4.361


  
🌌 **Bugs are evident™ - MATRIX️**  
🚧 **This project is under active development!**  
📢 **We welcome your feedback and contributions.**  
    



### NodeJS LTS is supported

### 🛠️ Built on NodeJs version

```txt
v24.14.1
```





# 📝 Description

                        
[//]: #@corifeus-header:end


This version requires minimum Node.js v22. This is part of the composable `p3x-redis-ui` package — the backend server built entirely on Socket.IO (no REST).

The server connects to the `p3x-redis-ui-material` dual frontend:

- **Angular** frontend (`/ng/`) — Angular + Angular Material + Webpack
- **React** frontend (`/react/`) — React + MUI + Vite + Zustand

Both frontends share the same Socket.IO protocol, **54 languages**, **7 themes** (4 dark + 3 light with auto system preference), and all features at full parity. Users can switch between Angular and React live in Settings.

### Key Capabilities

- **Socket.IO real-time communication** — all Redis operations via WebSocket events
- **ioredis client** — standalone, cluster, and sentinel support with optional SSH tunneling
- **Built-in login page** — custom JWT-based authentication with themed login dialog (replaces browser HTTP Basic Auth)
- **AI query translation** — natural language to Redis commands via Groq API, with bash pipe to EVAL Lua conversion
- **Auto data decompression** — GZIP, ZIP, zlib, Zstandard, LZ4, Snappy, Brotli
- **Desktop notifications** — Electron native + Web Notification API for disconnect/reconnect events
- **Auto language detection** — matches browser/system locale to one of 54 supported languages
- **Health check endpoint** — `GET /health` for Docker/Kubernetes probes
- **Graceful shutdown** — handles SIGTERM/SIGINT, closes all connections cleanly


## Configuration

For now, there are 2 configuration files:
```bash
p3xrs --config ./p3xrs.json
```

The 2nd configuration is the list of the connections if found in `p3xrs.json` it either in the config: 
```text
p3xrs.json/p3xrs.connections['home-dir'] = undefined|home|absolute|relative 
```

The best is to keep it undefined and it will be in your home dir, but you can choose any place as well.

You may also set connections file name which overrides default .p3xrs-conns.json
```text
p3xrs --connections-file-name .p3xrs-conns.json
```

## Authentication (Login Page)

Instead of relying on the browser's native HTTP Basic Auth dialog, P3X Redis UI has its own built-in login page. When authentication is enabled, the app displays a themed login dialog that integrates seamlessly with the UI -- supporting all 54 languages, all 7 themes, and the Angular/React GUI switcher.

The login flow uses JWT tokens (HS256, 24-hour expiry) with no external dependencies. The token is stored in the browser's localStorage and sent via Socket.IO handshake. A logout button appears in the top-right corner of the header toolbar when auth is active.

Config (`p3xrs.json`):

```json
{
  "p3xrs": {
    "httpAuth": {
      "enabled": true,
      "username": "admin",
      "passwordHash": "$2b$10$..."
    }
  }
}
```

Generate BCrypt password hash:

```bash
node ./bin/bcrypt-password.mjs -p myplainpass
```

Environment variables:

- `HTTP_USER`
- `HTTP_PASSWORD`
- `HTTP_PASSWORD_HASH`
- `HTTP_PASSWORD_HASH_FILE`
- `HTTP_AUTH_ENABLED` (`true|false`)

CLI options:

- `--http-auth-enable`
- `--http-auth-disable`
- `--http-auth-username`
- `--http-auth-password`
- `--http-auth-password-hash`
- `--http-auth-password-hash-file`

Notes:

- `passwordHash` is preferred over plain `password`.
- Use HTTPS/reverse proxy TLS when auth is enabled.
- JWT tokens expire on server restart (secret is derived from the password hash).

## AI-Powered Redis Query Translation

The AI feature translates natural language or CLI-style input into valid Redis commands. It supports bash-style pipe operations (e.g. `keys session:* | head -20 | sort`) by converting them into Redis EVAL Lua scripts that run atomically on the server.

- Powered by Groq API (model: `openai/gpt-oss-120b`)
- Supports all human languages as input
- Bash pipes (`head`, `tail`, `grep`, `sort`, `wc`, `uniq`) are translated to EVAL Lua
- Network proxy mode (via `network.corifeus.com`) or direct API key mode
- Configure via `--groq-api-key` CLI flag or the AI Settings panel in the UI


### Verbose CLI help

```text
Usage: p3xrs [options]

Options:
  -V, --version                           output the version number
  -c, --config [config]                   Set the p3xr.json p3x-redis-ui-server configuration, see more help in p3x-redis-ui-server
  -r, --readonly-connections              Set the connections to be readonly, no adding, saving or delete a connection
  -n, --connections-file-name [filename]  Set the connections file name, overrides default .p3xrs-conns.json
  --http-auth-enable                      Enable HTTP Basic auth
  --http-auth-disable                     Disable HTTP Basic auth
  --http-auth-username [username]         HTTP Basic auth username
  --http-auth-password [password]         HTTP Basic auth plain password
  --http-auth-password-hash [hash]        HTTP Basic auth bcrypt password hash
  --http-auth-password-hash-file [file]   Read HTTP Basic auth bcrypt password hash from file
  --groq-api-key [key]                    Groq API key for AI-powered Redis query translation (get a free key at console.groq.com)
  --groq-api-key-readonly                 Prevent users from changing the Groq API key via the UI
  -h, --help                              display help for command
```


# For development standalone

For file names do not use camelCase, but use kebab-case. Folder should be named as kebab-case as well. As you can see, all code filenames are using it like that, please do not change that.
Please apply the `.editorconfig` settings in your IDE.
  
Copy from `./artifacts/boot/p3xrs.json` to the root folder (`./p3xrs.json`).


```bash
yarn install
yarn run dev
```

It uses `nodemon` and when any file is changed, it will re-load it.

The server app is available @    
http://localhost:7843

[//]: #@corifeus-footer

---

## 🚀 Quick and Affordable Web Development Services

If you want to quickly and affordably develop your next digital project, visit [corifeus.eu](https://corifeus.eu) for expert solutions tailored to your needs.

---

## 🌐 Powerful Online Networking Tool  

Discover the powerful and free online networking tool at [network.corifeus.com](https://network.corifeus.com).  

**🆓 Free**  
Designed for professionals and enthusiasts, this tool provides essential features for network analysis, troubleshooting, and management.  
Additionally, it offers tools for:  
- 📡 Monitoring TCP, HTTP, and Ping to ensure optimal network performance and reliability.  
- 📊 Status page management to track uptime, performance, and incidents in real time with customizable dashboards.  

All these features are completely free to use.  

---

## ❤️ Support Our Open-Source Project  
If you appreciate our work, consider ⭐ starring this repository or 💰 making a donation to support server maintenance and ongoing development. Your support means the world to us—thank you!  

---

### 🌍 About My Domains  
All my domains, including [patrikx3.com](https://patrikx3.com), [corifeus.eu](https://corifeus.eu), and [corifeus.com](https://corifeus.com), are developed in my spare time. While you may encounter minor errors, the sites are generally stable and fully functional.  

---

### 📈 Versioning Policy  
**Version Structure:** We follow a **Major.Minor.Patch** versioning scheme:  
- **Major:** 📅 Corresponds to the current year.  
- **Minor:** 🌓 Set as 4 for releases from January to June, and 10 for July to December.  
- **Patch:** 🔧 Incremental, updated with each build.  

**🚨 Important Changes:** Any breaking changes are prominently noted in the readme to keep you informed.

---


[**P3X-REDIS-UI-SERVER**](https://corifeus.com/redis-ui-server) Build v2026.4.361

 [![NPM](https://img.shields.io/npm/v/p3x-redis-ui-server.svg)](https://www.npmjs.com/package/p3x-redis-ui-server)  [![Donate for PatrikX3 / P3X](https://img.shields.io/badge/Donate-PatrikX3-003087.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QZVM4V6HVZJW6)  [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Like Corifeus @ Facebook](https://img.shields.io/badge/LIKE-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)





[//]: #@corifeus-footer:end
