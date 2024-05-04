# This is a development package

For the full-blown package, please follow:     
https://github.com/patrikx3/redis-ui  
https://www.npmjs.com/package/p3x-redis-ui   
https://corifeus.com/redis-ui   

[//]: #@corifeus-header

 [![NPM](https://img.shields.io/npm/v/p3x-redis-ui-server.svg)](https://www.npmjs.com/package/p3x-redis-ui-server)  [![Donate for Corifeus / P3X](https://img.shields.io/badge/Donate-Corifeus-003087.svg)](https://paypal.me/patrikx3) [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Corifeus @ Facebook](https://img.shields.io/badge/Facebook-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)  [![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m780749701-41bcade28c1ea8154eda7cca.svg)](https://stats.uptimerobot.com/9ggnzcWrw)



---
# 🏍️ The p3x-redis-ui-server package motor that is connected to the p3x-redis-ui-material web user interface v2024.4.233



**Bugs are evident™ - MATRIX️**
    



### NodeJS LTS is supported

### Built on NodeJs version

```txt
v22.1.0
```





# Description

                        
[//]: #@corifeus-header:end


This is part of a composable  `p3x-redis-ui` package. This is the server based on Socket.IO (no rest at all).  
The server will be using the `p3x-redis-ui-material` web client package based on built with Webpack, Socket.IO and AngularJs Material.  
This package is named as `p3x-redis-ui-server`.


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


### Verbose CLI help

```text
patrikx3@workstation:~/Projects/patrikx3/redis-ui-workspace/redis-ui-server$ p3xrs.js --help
Usage: p3xrs [options]

Options:
  -V, --version                           output the version number
  -c, --config [config]                   Set the p3xr.json p3x-redis-ui-server configuration, see more help in https://github.com/patrikx3/redis-ui-server
  -r, --readonly-connections              Set the connections to be readonly, no adding, saving or delete a connection
  -n, --connections-file-name [filename]  Set the connections file name, overrides default .p3xrs-conns.json
  -h, --help                              output usage information
```


# For development standalone

For file names do not use camelCase, but use kebab-case. Folder should be named as kebab-case as well. As you can see, all code filenames are using it like that, please do not change that.
Please apply the `.editorconfig` settings in your IDE.
  
Copy from `./artifacts/boot/p3xrs.json` to the root folder (`./p3xrs.json`).


```bash
npm install
npm run dev
```

It uses `nodemon` and when any file is changed, it will re-load it.

The server app is available @    
http://localhost:7843

[//]: #@corifeus-footer

---


## Support Our Open-Source Project ❤️
If you appreciate our work, consider starring this repository or making a donation to support server maintenance and ongoing development. Your support means the world to us—thank you!

### Server Availability
Our server may occasionally be down, but please be patient. Typically, it will be back online within 15-30 minutes. We appreciate your understanding.

### About My Domains
All my domains, including [patrikx3.com](https://patrikx3.com) and [corifeus.com](https://corifeus.com), are developed in my spare time. While you may encounter minor errors, the sites are generally stable and fully functional.

### Versioning Policy
**Version Structure:** We follow a Major.Minor.Patch versioning scheme:
- **Major:** Corresponds to the current year.
- **Minor:** Set as 4 for releases from January to June, and 10 for July to December.
- **Patch:** Incremental, updated with each build.

**Important Changes:** Any breaking changes are prominently noted in the readme to keep you informed.

---


[**P3X-REDIS-UI-SERVER**](https://corifeus.com/redis-ui-server) Build v2024.4.233

 [![NPM](https://img.shields.io/npm/v/p3x-redis-ui-server.svg)](https://www.npmjs.com/package/p3x-redis-ui-server)  [![Donate for Corifeus / P3X](https://img.shields.io/badge/Donate-Corifeus-003087.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QZVM4V6HVZJW6)  [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Like Corifeus @ Facebook](https://img.shields.io/badge/LIKE-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)






[//]: #@corifeus-footer:end
