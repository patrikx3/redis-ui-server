module.exports = function getDefaultPasswordFromServer(server){
  const server1 = Array.isArray(server) ? server[0] : server
  if(typeof server1 === 'object' && server1 !== null){
    return server1.password
  }
}