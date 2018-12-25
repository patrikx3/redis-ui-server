# This is a development package

For the full-blown package, please follow:     
https://github.com/patrikx3/redis-ui  
https://www.npmjs.com/package/p3x-redis-ui   
https://pages.corifeus.com/redis-ui   

[//]: #@corifeus-header

 [![Build Status](https://travis-ci.org/patrikx3/redis-ui-server.svg?branch=master)](https://travis-ci.org/patrikx3/redis-ui-server) 
[![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m780749701-41bcade28c1ea8154eda7cca.svg)](https://uptimerobot.patrikx3.com/)

  
 
---
# 🏍️ The p3x-redis-ui-server package motor that is will be connected to the p3x-redis-ui-material web user interface. v2018.12.25-5  

This is an open-source project. Star this repository, if you like it, or even donate! Thank you so much! :)

I run my own server with dynamic IP address, so, it may happen, that the server can not be reachable for about max 15 minutes, due to nature of the dynamic DNS. The server may also be unreachable, when I backup the SSD with Clonzilla (very rarely) or an electrical issue (but this should not happen again). When the server is down, please hang on for 15-30 minutes and the server will be back up.

All my domains (patrikx3.com and corifeus.com) could have errors, since I am developing in my free time. However, it is usually stable.

**Bugs are evident™ - MATRIX️**

### Node Version Requirement 
``` 
>=10.13.0 
```  
   
### Built on Node 
``` 
v11.5.0
```   
   
The ```async``` and ```await``` keywords are required.

Install NodeJs:    
https://nodejs.org/en/download/package-manager/    



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

# For development standalone

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

[**P3X-REDIS-UI-SERVER**](https://pages.corifeus.com/redis-ui-server) Build v2018.12.25-5 

[![Like Corifeus @ Facebook](https://img.shields.io/badge/LIKE-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software) [![Donate for Corifeus / P3X](https://img.shields.io/badge/Donate-Corifeus-003087.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QZVM4V6HVZJW6)  [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) 


## P3X Sponsors

[IntelliJ - The most intelligent Java IDE](https://www.jetbrains.com)
  
[![JetBrains](https://cdn.corifeus.com/assets/svg/jetbrains-logo.svg)](https://www.jetbrains.com/) [![NoSQLBooster](https://cdn.corifeus.com/assets/png/nosqlbooster-70x70.png)](https://www.nosqlbooster.com/)

[The Smartest IDE for MongoDB](https://www.nosqlbooster.com)
  
  
 

[//]: #@corifeus-footer:end